const express = require('express');
const { Server } = require('http');
const socket = require('socket.io');
const Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk
const axios = require('axios');
const moment = require('moment');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const watson = require('watson-developer-cloud');
const cors = require('cors');
const socketioJwt = require('socketio-jwt');
const fs = require('fs');
const { findNextFreeTimeSlot } = require('./modules/calender');
const iot = require('ibmiotf');
const _ = require('lodash');

const port = process.env.PORT || 3000;
const app = express();
const server = Server(app);
const io = socket(server);
const CUSTOMER_ROOT_URL = process.env.CUSTOMER_ROOT_URL || 'http://localhost:3002';
const EMPLOYEE_ROOT_URL = process.env.EMPLOYEE_ROOT_URL || 'http://localhost:3001';
const appClientConfig = {
  org: '3j3jat',
  id: 'team-6-backend-2',
  'auth-key': 'a-3j3jat-vqtqgilelq',
  'auth-token': 'qGdaWWqjw757xR63SI',
  'type ': 'shared',
};
const appClient = new iot.IotfApplication(appClientConfig);
appClient.connect();

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

const key = fs.readFileSync(`${__dirname}/public.pem`);
io.on('connection', socketioJwt.authorize({
  secret: key,
  timeout: 15000, // 15 seconds to send the authentication message
})).on('authenticated', (socket) => {
  // this socket is authenticated, we are good to handle more events from it.
  console.log('a user connected');
  // initialize bot context for user and Replace with the context obtained from the initial request
  let context = {};
  let responseText = '';
  // set userid in context
  context.userid = socket.decoded_token.email;
  // emit welcome message
  io.emit('bot-message', {
    role: 'bot',
    text: 'Hi, what can I do for you?',
    timestamp: Date.now(),
    context,
  });

  // Predictive Maintanance: triggered by MQTT wait for signals and send a message to the client
  const getCarStatus = () => {
    axios.get('http://obd2-car-dashboard-cs.mybluemix.net/cardata/5/summary')
    .then((result) => {
      // destionation distance
      const destionationDistance = 10000;
      // consumption per 100 km
      const avgconsumption = result.data.avgconsumption;
      // liters of fuel left
      const fuelLeft = result.data.fuel;
      const reach = _.round((fuelLeft / avgconsumption) * 100, 2);
      if (reach < destionationDistance) {
        io.emit('bot-message', {
          role: 'bot',
          text: `Adam, in order to reach Munich please drive slower or fill up your tank. Your current reach is only ${reach} km. There is a fuel station in about 5 km.`,
          timestamp: Date.now(),
          context,
        });
        const myData = JSON.stringify({
          on: true,
          hue: 46920,
        });
        appClient.publishDeviceCommand('hueLight', 'hueLight461B987', 'action', 'json', myData);
      }
    });
  };
  // setTimeout(getCarStatus, 15000);

  // const predictiveTimer = setInterval(predictiveAlert, 3000);
  // setTimeout(predictiveAlert, 3000);


  // wait for chat input
  socket.on('chat-input', (from, msg) => {
    // Start conversation with empty message.
    console.log('MSG:', msg);
    if (msg.text.search('occupancy')) {
      const myData = JSON.stringify({
        on: true,
        hue: 0,
      });
      appClient.publishDeviceCommand('hueLight', 'hueLight461B987', 'action', 'json', myData);
    }

    conversation.message(
      {
        workspace_id: 'fb7bb377-e523-439a-88fd-dd1ac0db1dc7',
        input: { text: msg.text },
        context: Object.assign({}, context, msg.context),
      }, (err, response) => {
      if (err) {
        console.error(err);
        return;
      }
      // Display the output from dialog, if any.
      if (response.output.text.length !== 0) {
        context = response.context;
        responseText = response.output.text[0];
        // call function that finds open keywords
        if (/\$\[/.test(responseText)) {
          // customernumber -> ask for responsible agent
          axios.get(`${CUSTOMER_ROOT_URL}/customers/${context.userid}`)
          .then((resCustomer) => {
            const responsibleAgentId = resCustomer.data.customer.centralagentid;
            // agendid -> find the right time for the responsible agent
            axios.get(`${EMPLOYEE_ROOT_URL}/employees/${responsibleAgentId}`)
            .then((employeeRes) => {
              const employee = employeeRes.data.employee;
              responseText = responseText.replace(/\$\[call_agent\]/i, employee.name);
              // compute next free meeting time
              let nextFreeMeetingTime;
              // find todays slot in employee calender with all meetings after
              // if undefined give a meeting now
              if (typeof employee.nonAvailablility === 'undefined') {
                nextFreeMeetingTime = moment();
                context.nextFreeMeetingTime = nextFreeMeetingTime;
                axios.patch(`${EMPLOYEE_ROOT_URL}/employees/${responsibleAgentId}/termin`, {
                  todo: 'fill with something',
                  start: nextFreeMeetingTime,
                  end: nextFreeMeetingTime.clone().add(30, 'm'),
                });
              } else {
                // with end date after now
                nextFreeMeetingTime = findNextFreeTimeSlot(employee.nonAvailablility);
                context.nextFreeMeetingTime = nextFreeMeetingTime;
                axios.patch(`${EMPLOYEE_ROOT_URL}/employees/${responsibleAgentId}/termin`, {
                  todo: 'fill with something',
                  start: nextFreeMeetingTime,
                  end: nextFreeMeetingTime.clone().add(30, 'm'),
                }).catch(error => console.log('Error:', error));
              }


              if (/\$\[reschedule_call_date\]/i.test(responseText)) {
                console.log('get the old time, slice the calender with old time + 1 day or some setoff provided by the user');
                context.nextFreeMeetingTime = context.nextFreeMeetingTime.clone().add(21, 'h');
                responseText = responseText
                             .replace(/\$\[reschedule_call_date\]/i, `${context.nextFreeMeetingTime.get('date')}.${context.nextFreeMeetingTime.get('month') + 1}.${context.nextFreeMeetingTime.get('year')}`)
                             .replace(/\$\[reschedule_call_time\]/i, `${context.nextFreeMeetingTime.get('hours')}:${context.nextFreeMeetingTime.get('minutes')}`);
              }
              // check if the last one was an #agree then make the time fixed
              // schedule meeting by proposing time to user
              responseText = responseText
                             .replace(/\$\[call_date\]/i, `${nextFreeMeetingTime.get('date')}.${nextFreeMeetingTime.get('month') + 1}.${nextFreeMeetingTime.get('year')}`)
                             .replace(/\$\[call_time\]/i, `${nextFreeMeetingTime.get('hours')}:${nextFreeMeetingTime.get('minutes')}`);
              io.emit('bot-message', {
                role: 'bot',
                text: responseText,
                timestamp: Date.now(),
                context,
              });
            });
          })
          .catch(getCustomerErr => console.log('ERROR:', getCustomerErr));
        } else {
          console.log('RESPONSE:', response);
          try {
            if (typeof response.entities[0].value !== undefined && response.entities[0].value === 'music') {
              // axios.post('http://obd2-car-dashboard-cs.mybluemix.net/lighton', { id: 4 });
              const myData = JSON.stringify({
                on: true,
                hue: 22550,
              });
              appClient.publishDeviceCommand('hueLight', 'hueLight461B987', 'action', 'json', myData);
              setTimeout(getCarStatus, 10000);
            }
          } catch (err) {
            console.log(err);
          }

          io.emit('bot-message', {
            role: 'bot',
            text: responseText,
            timestamp: Date.now(),
            context,
          });
        }
      }
    });
  });
});

server.listen(port, (err) => {
  if (err) {
    console.log(`Error: ${err}`);
  }
});
