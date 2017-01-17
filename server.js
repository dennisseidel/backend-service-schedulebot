const express = require('express');
const { Server } = require('http');
const socket = require('socket.io');

const port = process.env.PORT || 3000;
const app = express();
const server = Server(app);
const io = socket(server);

server.listen(port, (err) => {
  if (err) {
    console.log(`Error: ${err}`);
  }
});
