const express = require('express');
const { Server } = require('http');
const socket = require('socket.io');

const port = process.env.PORT || 3000;
const app = express();
const server = Server(app);
const io = socket(server);

io.on('connection', (socket) => {
  console.log('a user connected');
  io.emit('bot-message', {
    role: 'bot',
    text: 'Hi, what can I do for you?',
    timestamp: Date.now(),
  });
  socket.on('chat-input', (from, msg) => {
    console.log('I received a private message by ', from, ' saying ', msg);
    socket.emit('bot-message', {
      role: 'bot',
      text: `This is a test answer for: ${from}'s message: ${msg.text}`,
      timestamp: Date.now(),
    });
  });

  socket.on('disconnect', () => {
    io.emit('user disconnected');
  });
});

server.listen(port, (err) => {
  if (err) {
    console.log(`Error: ${err}`);
  }
});
