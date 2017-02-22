const express = require('express');
const { Server } = require('http');
const socket = require('socket.io');
const Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk
const bodyParser = require('body-parser');
const morgan = require('morgan');
const watson = require('watson-developer-cloud');
const cors = require('cors');
const { dateAgent, callAgents } = require('./modules/agents');

const port = process.env.PORT || 3000;
const app = express();
const server = Server(app);
const io = socket(server);

app.use(bodyParser.json());
app.use(morgan('combined'));
app.use(cors());


// Endpoint to retrieve an watson speech to text api token
// Get token using your credentials
const tts = new watson.TextToSpeechV1({
  username: process.env.TTS_SERVICE_USER,
  password: process.env.TTS_SERVICE_PW,
});
const authServiceTTS = new watson.AuthorizationV1(tts.getCredentials());
app.get('/watsoncloud/tts/token', (req, res, next) => {
  // TODO check jwt at the auth service
  authServiceTTS.getToken((err, token) => {
    if (err) {
      next(err);
    } else {
      res.send({ token });
    }
  });
});

const stt = new watson.SpeechToTextV1({
  // if left undefined, username and password to fall back to the SPEECH_TO_TEXT_USERNAME and
  // SPEECH_TO_TEXT_PASSWORD environment properties, and then to VCAP_SERVICES (on Bluemix)
  username: process.env.STT_SERVICE_USER,
  password: process.env.STT_SERVICE_PW,
});
const authService = new watson.AuthorizationV1(stt.getCredentials());
// Endpoint to retrieve an watson speech to text api token
// Get token using your credentials
app.get('/watsoncloud/stt/token', (req, res, next) => {
  // TODO check jwt at the auth service
  authService.getToken((err, token) => {
    if (err) {
      next(err);
    } else {
      res.send({ token });
    }
  });
});

// Create the service wrapper
const conversation = new Conversation({
  // If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD
  // env properties will be checked
  // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
  username: process.env.CONVERSATION_SERVICE_USER,
  password: process.env.CONVERSATION_SERVICE_PW,
  url: 'https://gateway.watsonplatform.net/conversation/api',
  // path: { workspace_id: 'fb7bb377-e523-439a-88fd-dd1ac0db1dc7' },
  version_date: '2016-12-29',
});


io.on('connection', (socket) => {
  console.log('a user connected');
  // initialize bot context for user and Replace with the context obtained from the initial request
  let context = {};
  const responseText = '';

  io.emit('bot-message', {
    role: 'bot',
    text: 'Hi, what can I do for you?',
    timestamp: Date.now(),
  });

  socket.on('chat-input', (from, msg) => {
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
      if (response.output.text.length !== 0) {
        // call function that finds open keywords
        if (/\$\[/.test(response.output.text[0])) {
          // TODO group it under a $[call_date] and $[reschedule_call_date] or set context?
          // const dateAgentPromise = dateAgent(responseText, '5894ec04d3ab69003a98e746');
          // TODO externalize the creation of a agentPromiseArray based on the message object into a function
          // call this from here and inside the callAgents function
          // userid in context?
          // add userid to context:
          const newResponse = response;
          // TODO get the customernumber dynamically from client and put it into context
          // (and instert it in the function that is called based on the keyword [call_date])
          newResponse.context.userId = '5894ec04d3ab69003a98e746';
          callAgents(newResponse, io);
        } else {
          io.emit('bot-message', {
            role: 'bot',
            text: responseText,
            timestamp: Date.now(),
          });
        }
        context = response.context;
      }
    });
  });
});

server.listen(port, (err) => {
  if (err) {
    console.log(`Error: ${err}`);
  }
});
