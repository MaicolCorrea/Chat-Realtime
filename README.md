# Chat en Tiempo Real con WebSocket

Bienvenido al proyecto **Chat en Tiempo Real**, una aplicación basada en WebSockets que permite la comunicación instantánea entre usuarios. Este proyecto está desplegado en [Render](https://chat-realtime-utds.onrender.com) y utiliza **Node.js** con **Socket.io** para la conexión en tiempo real y **Tusco** como base de datos para almacenar los mensajes.

## Tecnologías Utilizadas
- **Node.js** - Backend en JavaScript.
- **Socket.io** - Implementación de WebSockets.
- **Tusco** - Base de datos para almacenar mensajes.
- **Render** - Plataforma de despliegue.

## Instalación y Ejecución Local
1. Clona este repositorio:
   ```sh
   git clone [<URL_DEL_REPO>](https://github.com/MaicolCorrea/Chat-Realtime.git)
   cd Chat-Realtime
   ```
2. Instala las dependencias:
   ```sh
   npm install
   ```
3. Ejecuta el servidor:
   ```sh
   npm start
   ```

## Uso
1. Abre la URL del despliegue: [https://chat-realtime-utds.onrender.com](https://chat-realtime-utds.onrender.com).
2. Conéctate al chat y empieza a enviar mensajes en tiempo real.

## API WebSocket
El servidor expone los siguientes eventos:
- `connect` - Establece la conexión con el servidor.
- `message` - Envío y recepción de mensajes.
- `disconnect` - Maneja la desconexión de usuarios.
- `randomUser` - Crea un usuario aleatorio para verificar que un usuario nuevo esta enviando un mensaje.

## Contribución
Si deseas contribuir, abre un issue o un pull request. Toda ayuda es bienvenida.

---
Desarrollado con ❤ por [Michael Smith Correa Lopez]

