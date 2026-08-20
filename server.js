const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log(`> Usuario conectado: ${socket.id}`);

    // Avisar al otro dispositivo que alguien ha entrado
    socket.broadcast.emit('user-joined');

    socket.on('join-room', () => {
        socket.broadcast.emit('user-joined');
    });

    // Puente de señalización WebRTC para las cámaras
    socket.on('offer', (data) => socket.broadcast.emit('offer', data));
    socket.on('answer', (data) => socket.broadcast.emit('answer', data));
    socket.on('ice-candidate', (data) => socket.broadcast.emit('ice-candidate', data));

    // Chat y multimedia
    socket.on('chat-message', (data) => {
        socket.broadcast.emit('chat-message', { ...data, sender: 'Remoto' });
    });

    socket.on('disconnect', () => {
        console.log(`> Usuario desconectado: ${socket.id}`);
    });
});

server.listen(3000, '0.0.0.0', () => {
    console.log(`🍸 Servidor de El Pirulo de Xavi activo en http://localhost:3000`);
});