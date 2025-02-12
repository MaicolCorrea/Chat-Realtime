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
                username TEXT
            )
        `)
        console.log('Database initialized')
    } catch (e) {
        console.error('Error initializing database:', e)
    }
}

// Configuración de Socket.IO
io.on('connection', async (socket) => {
    console.log('a user has connected!');

    socket.on('disconnect', () => {
        console.log('an user has disconnected');
    });

    socket.on('chat message', async (msg) => {
        let result
        let username = socket.handshake.auth.username ?? 'anonymous'
        try {
            result = await db.execute({
                sql: 'INSERT INTO messages (content, username) VALUES (:msg, :username)',
                args: { msg, username }
            });
        } catch (e) {
            console.error(e)
            return
        }
        io.emit('chat message', msg, result.lastInsertRowid.toString(), username)
    });

    if (!socket.recovered) {
        try {
            const results = await db.execute({
                sql: 'SELECT id, content, username FROM messages WHERE id > ?',
                args: [socket.handshake.auth.serverOffset ?? 0]
            });

            results.rows.forEach(row => {
                socket.emit('chat message', row.content, row.id.toString(), row.username);
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