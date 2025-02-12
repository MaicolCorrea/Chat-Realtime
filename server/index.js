import express from 'express'
import logger from 'morgan'
import dotenv from 'dotenv'
import { createClient } from '@libsql/client'
import { Server } from 'socket.io'
import { createServer } from 'node:http'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

dotenv.config()

const port = process.env.PORT ?? 3000

const app = express()
const server = createServer(app)
const io = new Server(server, {
    connectionStateRecovery: {}
})

const connectedUsers = new Set()

// Servir archivos estáticos
app.use(express.static(join(__dirname, '../client')))
app.use(logger('dev'))

const db = createClient({
    url: 'libsql://grateful-timeslip-analistaist1.turso.io',
    authToken: process.env.DB_TOKEN
})

// Inicialización de la base de datos
async function initDB() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT,
                username TEXT,
                reply_to INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS reactions (
                message_id INTEGER,
                username TEXT,
                reaction TEXT,
                UNIQUE(message_id, username)
            )`);

        console.log('Database initialized')
    } catch (e) {
        console.error('Error initializing database:', e)
    }
}

// Configuración de Socket.IO
io.on('connection', async (socket) => {
    const username = socket.handshake.auth.username
    connectedUsers.add(username)
    io.emit('user list', Array.from(connectedUsers))

    console.log('a user has connected!');

    // Cargar mensajes existentes
    if (!socket.recovered) {
        try {
            const results = await db.execute({
                sql: `
                    SELECT m.id, m.content, m.username, m.created_at, m.reply_to,
                           GROUP_CONCAT(r.username || ':' || r.reaction) as reactions
                    FROM messages m
                    LEFT JOIN reactions r ON m.id = r.message_id
                    GROUP BY m.id
                    ORDER BY m.created_at ASC
                    LIMIT 50
                `
            });

            for (const row of results.rows) {
                socket.emit('chat message', 
                    row.content,
                    row.id.toString(),
                    row.username,
                    row.id.toString(),
                    row.reply_to?.toString()
                );

                // Enviar reacciones existentes
                if (row.reactions) {
                    const reactionsList = row.reactions.split(',');
                    for (const reactionData of reactionsList) {
                        const [reactUsername, reaction] = reactionData.split(':');
                        socket.emit('reaction added', {
                            messageId: row.id.toString(),
                            username: reactUsername,
                            reaction
                        });
                    }
                }
            }
        } catch (e) {
            console.error('Error loading messages:', e)
        }
    }

    socket.on('disconnect', () => {
        connectedUsers.delete(username)
        io.emit('user list', Array.from(connectedUsers))
        console.log('an user has disconnected');
    });

    socket.on('chat message', async (msg) => {
        try {
            const result = await db.execute({
                sql: 'INSERT INTO messages (content, username) VALUES (:msg, :username)',
                args: { msg, username }
            });
            // Convertir BigInt a String antes de enviarlo
            const messageId = result.lastInsertRowid.toString()
            io.emit('chat message', msg, messageId, username, messageId)
        } catch (e) {
            console.error(e)
        }
    });

    socket.on('delete message', async (messageId) => {
        try {
            const message = await db.execute({
                sql: 'SELECT username FROM messages WHERE id = ?',
                args: [messageId]
            })

            if (message.rows[0]?.username === username) {
                await db.execute({
                    sql: 'DELETE FROM messages WHERE id = ?',
                    args: [messageId]
                })
                io.emit('message deleted', messageId)
            }
        } catch (e) {
            console.error(e)
        }
    })

    socket.on('typing', (isTyping) => {
        socket.broadcast.emit('user typing', { username: socket.handshake.auth.username, isTyping });
    });

    socket.on('change username', async (newUsername) => {
        const oldUsername = socket.handshake.auth.username;
        socket.handshake.auth.username = newUsername;
        
        await db.execute({
            sql: 'UPDATE messages SET username = :newUsername WHERE username = :oldUsername',
            args: { newUsername, oldUsername }
        });

        connectedUsers.delete(oldUsername);
        connectedUsers.add(newUsername);
        io.emit('user list', Array.from(connectedUsers));
        io.emit('username changed', { oldUsername, newUsername });
    });

    socket.on('add reaction', async ({ messageId, reaction }) => {
        try {
            await db.execute({
                sql: 'INSERT OR REPLACE INTO reactions (message_id, username, reaction) VALUES (?, ?, ?)',
                args: [messageId, socket.handshake.auth.username, reaction]
            });
            io.emit('reaction added', { messageId, username: socket.handshake.auth.username, reaction });
        } catch (e) {
            console.error(e);
        }
    });

    socket.on('reply message', async ({ replyToId, content }) => {
        try {
            const result = await db.execute({
                sql: 'INSERT INTO messages (content, username, reply_to) VALUES (?, ?, ?)',
                args: [content, socket.handshake.auth.username, replyToId]
            });
            const messageId = result.lastInsertRowid.toString();
            io.emit('chat message', content, messageId, socket.handshake.auth.username, messageId, replyToId);
        } catch (e) {
            console.error(e);
        }
    });
})

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, '../client/index.html'))
})

// Iniciar servidor
await initDB()
server.listen(port, () => {
    console.log(`Server running on port ${port}`)
})