const express = require('express');
const { Server } = require('http');
const socket = require('socket.io');
const Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk
const axios = require('axios');
const _ = require('lodash');
const moment = require('moment');
const { findTodaysCalenderEntry, findNextFreeTimeSlot } = require('./modules/calender');

const today = moment().format('YYYY-MM-DD');

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
        context = response.context;
        let responseText = response.output.text[0];
        // call function that finds open keywords
        if (/\$\[/.test(responseText)) {
          // TODO get the customernumber dynamically from client
          const mockCustomerNumber = '5884cace0de4b4642da047dc';
          // customernumber -> ask for responsible agent
          axios.get(`http://localhost:3002/customers/${mockCustomerNumber}`)
          .then((resCustomer) => {
            const responsibleAgentId = resCustomer.data.customer.centralagentid;
            // agendid -> find the right time for the responsible agent
            axios.get(`http://localhost:3001/employees/${responsibleAgentId}`)
            .then((employeeRes) => {
              const employee = employeeRes.data.employee;
              // console.log('EMPLOYEE:', JSON.stringify(employee));
              responseText = responseText.replace(/\$\[call_agent\]/i, employee.name);
              // compute next free meeting time
              let nextFreeMeetingTime;
              // find todays slot in employee calender with all meetings after
              // if undefined give a meeting now
              if (typeof employee.nonAvailablility === 'undefined') {
                // TODO create termin in the employee calender now
                nextFreeMeetingTime = moment();
              } else {
                // with end date after now
                nextFreeMeetingTime = findNextFreeTimeSlot(employee.nonAvailablility[0][today]);
              }
              // schedule meeting by proposing time to user
              responseText = responseText
                             .replace(/\$\[call_date\]/i, `${nextFreeMeetingTime.get('date')}.${nextFreeMeetingTime.get('month') + 1}`)
                             .replace(/\$\[call_time\]/i, `${nextFreeMeetingTime.get('hours')}:${nextFreeMeetingTime.get('minutes')}`);
              io.emit('bot-message', {
                role: 'bot',
                text: responseText,
                timestamp: Date.now(),
              });
            });
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
