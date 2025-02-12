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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `)
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

    if (!socket.recovered) {
        try {
            const results = await db.execute({
                sql: 'SELECT id, content, username, created_at FROM messages ORDER BY created_at DESC LIMIT 50',
                args: []
            });

            // Invertir el orden para mostrar los más antiguos primero
            results.rows.reverse().forEach(row => {
                socket.emit('chat message', row.content, row.id.toString(), row.username, row.id.toString());
            });
        } catch (e) {
            console.error(e)
        }
    }
})

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, '../client/index.html'))
})

// Iniciar servidor
await initDB()
server.listen(port, () => {
    console.log(`Server running on port ${port}`)
})