const express = require('express');
const { Server } = require('http');
const socket = require('socket.io');
const Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk


const port = process.env.PORT || 3000;
const app = express();
const server = Server(app);
const io = socket(server);

// Create the service wrapper
const conversation = new Conversation({
  // If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD env properties will be checked
  // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
  username: 'a7a8383d-f647-4f2c-bf10-875c77b693ba',
  password: 'NrsIkzic40Fo',
  url: 'https://gateway.watsonplatform.net/conversation/api',
  // path: { workspace_id: 'fb7bb377-e523-439a-88fd-dd1ac0db1dc7' },
  version_date: '2016-12-29',
});


io.on('connection', (socket) => {
  console.log('a user connected');
  // initialize bot context for user and Replace with the context obtained from the initial request
  let context = {};
  io.emit('bot-message', {
    role: 'bot',
    text: 'Hi, what can I do for you?',
    timestamp: Date.now(),
  });
  socket.on('chat-input', (from, msg) => {
    console.log('I received a private message by ', from, ' saying ', msg);
    // Start conversation with empty message.
    conversation.message(
      {
        workspace_id: 'fb7bb377-e523-439a-88fd-dd1ac0db1dc7',
        input: { text: msg.text },
        context,
      }, (err, response) => {
      if (err) {
        console.error(err); // something went wrong
        return;
      }

      // Display the output from dialog, if any.
      if (response.output.text.length != 0) {
        console.log(response.output);
        context = response.context;
        console.log('! RESPONSE:', response);
        io.emit('bot-message', {
          role: 'bot',
          text: response.output.text[0],
          timestamp: Date.now(),
        });
      }
    });
  });
});

server.listen(port, (err) => {
  if (err) {
    console.log(`Error: ${err}`);
  }
});
