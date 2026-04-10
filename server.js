const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const players = {};
const COLORS = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#e91e63'];

io.on('connection', (socket) => {
  const idx = Object.keys(players).length % COLORS.length;
  players[socket.id] = {
    id: socket.id,
    x: (Math.random() - 0.5) * 30,
    y: 0,
    z: (Math.random() - 0.5) * 30,
    ry: 0,
    speed: 0,
    color: COLORS[idx],
    name: 'Sürücü ' + (Object.keys(players).length + 1)
  };

  socket.emit('init', { id: socket.id, players });
  socket.broadcast.emit('playerJoined', players[socket.id]);

  socket.on('setName', (name) => {
    if (players[socket.id]) {
      players[socket.id].name = name.substring(0, 16);
      socket.broadcast.emit('playerRenamed', { id: socket.id, name: players[socket.id].name });
    }
  });

  socket.on('update', (data) => {
    if (!players[socket.id]) return;
    Object.assign(players[socket.id], data);
    socket.broadcast.emit('playerMoved', { id: socket.id, ...data });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerLeft', socket.id);
  });
});

const PORT = process.env.PORT || 3020;
server.listen(PORT, () => console.log(`🏙️ Istanbul Racing: http://localhost:${PORT}`));
