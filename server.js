const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let waitingUser = null;

io.on('connection', (socket) => {
    console.log(`> Usuario conectado: ${socket.id}`);

    socket.on('ready-to-chat', () => {
        if (waitingUser && waitingUser !== socket.id) {
            console.log(`> Emparejando ${waitingUser} con ${socket.id}`);
            io.to(waitingUser).emit('make-initiator', socket.id);
            socket.emit('make-initiator', waitingUser);
            waitingUser = null;
        } else {
            waitingUser = socket.id;
        }
    });

    // Señalización WebRTC
    socket.on('offer', (data) => {
        io.to(data.target).emit('offer', { offer: data.offer, sender: socket.id });
    });

    socket.on('answer', (data) => {
        io.to(data.target).emit('answer', { answer: data.answer, sender: socket.id });
    });

    socket.on('ice-candidate', (data) => {
        io.to(data.target).emit('ice-candidate', { candidate: data.candidate });
    });

    // Canal de vídeo optimizado por socket (Garantía total en datos y Wi-Fi)
    socket.on('video-frame', (data) => {
        socket.broadcast.emit('video-frame', data);
    });

    // Chat y multimedia
    socket.on('chat-message', (data) => {
        socket.broadcast.emit('chat-message', {
            type: data.type,
            content: data.content,
            sender: 'Remoto'
        });
    });

    socket.on('disconnect', () => {
        if (waitingUser === socket.id) waitingUser = null;
        console.log(`> Usuario desconectado: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🍸 Servidor de El Pirulo de Xavi activo en http://localhost:${PORT}`);
});