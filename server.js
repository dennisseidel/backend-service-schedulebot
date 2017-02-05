const express = require('express');
const { Server } = require('http');
const socket = require('socket.io');
const Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk
const axios = require('axios');
const moment = require('moment');
const { findNextFreeTimeSlot } = require('./modules/calender');

const port = process.env.PORT || 3000;
const app = express();
const server = Server(app);
const io = socket(server);
const CUSTOMER_ROOT_URL = process.env.CUSTOMER_ROOT_URL || 'http://localhost:3002';
const EMPLOYEE_ROOT_URL = process.env.EMPLOYEE_ROOT_URL || 'http://localhost:3001';

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
    io.emit('bot-message', {
      role: 'bot',
      text: 'responseText',
      timestamp: Date.now(),
    });
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
          // TODO get the customernumber dynamically from client (and instert it in the function that is called based on the keyword [call_date])
          const mockCustomerNumber = '5884cace0de4b4642da047dc';
          // customernumber -> ask for responsible agent
          axios.get(`${CUSTOMER_ROOT_URL}/customers/${mockCustomerNumber}`)
          .then((resCustomer) => {
            console.log('CUSTOMER OBJECT:', resCustomer);
            const responsibleAgentId = resCustomer.data.customer.centralagentid;
            // agendid -> find the right time for the responsible agent
            axios.get(`${EMPLOYEE_ROOT_URL}/employees/${responsibleAgentId}`)
            .then((employeeRes) => {
              console.log('EMPLOYEE OBJECT:', employeeRes);
              const employee = employeeRes.data.employee;
              responseText = responseText.replace(/\$\[call_agent\]/i, employee.name);
              // compute next free meeting time
              let nextFreeMeetingTime;
              // find todays slot in employee calender with all meetings after
              // if undefined give a meeting now
              if (typeof employee.nonAvailablility === 'undefined') {
                nextFreeMeetingTime = moment();
                axios.patch(`${EMPLOYEE_ROOT_URL}/employees/${responsibleAgentId}/termin`, {
                  todo: 'fill with something',
                  start: nextFreeMeetingTime,
                  end: nextFreeMeetingTime.clone().add(30, 'm'),
                });
              } else {
                // with end date after now
                nextFreeMeetingTime = findNextFreeTimeSlot(employee.nonAvailablility);
                axios.patch(`${EMPLOYEE_ROOT_URL}/employees/${responsibleAgentId}/termin`, {
                  todo: 'fill with something',
                  start: nextFreeMeetingTime,
                  end: nextFreeMeetingTime.clone().add(30, 'm'),
                }).catch(error => console.log('Error:', error));
              }


              if (/\$\[reschedule_call_date\]/i.test(responseText)) {
                console.log('get the old time, slice the calender with old time + 1 day or some setoff provided by the user');
              }
              // schedule meeting by proposing time to user
              responseText = responseText
                             .replace(/\$\[call_date\]/i, `${nextFreeMeetingTime.get('date')}.${nextFreeMeetingTime.get('month') + 1}.${nextFreeMeetingTime.get('year')}`)
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
