const axios = require('axios');
const moment = require('moment');
const Promise = require('bluebird');
const { findNextFreeTimeSlot } = require('../modules/calender');

const CUSTOMER_ROOT_URL = process.env.CUSTOMER_ROOT_URL || 'http://localhost:3002';
const EMPLOYEE_ROOT_URL = process.env.EMPLOYEE_ROOT_URL || 'http://localhost:3001';

// this agent task a responsible agentid and finds a possible meeting date
const dateAgent = message => new Promise((resolve, reject) => {
  // check if the agent has something to do
  // && the responsible agent allready has been identified
  if (message.isArray || typeof (message.context.responsibleAgentId) !== 'undefined' || !/\$\[call_date\]/i.test(message.output.text[0])) {
    reject('Nothing to do for this agent.');
    // return '';
  }
  // console.log('DATEIN:', message);
  const responsibleAgentId = message.context.responsibleAgentId;
  const customerNumber = message.context.userId;
  const outMessage = message;
  // agendid -> find the right time for the responsible agent
  axios.get(`${EMPLOYEE_ROOT_URL}/employees/${responsibleAgentId}`)
  .then((employeeRecord) => {
    const employee = employeeRecord.data.employee;
    // compute next free meeting time
    let nextFreeMeetingTime;
    // find todays slot in employee calender with all meetings after if undefined
    // give a meeting now
    if (typeof employee.nonAvailablility === 'undefined') {
      nextFreeMeetingTime = moment();
      axios.patch(`${EMPLOYEE_ROOT_URL}/employees/${responsibleAgentId}/termin`, {
        participantid: customerNumber,
        todo: 'fill with something',
        start: nextFreeMeetingTime,
        end: nextFreeMeetingTime.clone().add(30, 'm'),
      }).catch(error => reject(Error(error)));
    } else {
      // with end date after now
      nextFreeMeetingTime = findNextFreeTimeSlot(employee.nonAvailablility);
      axios.patch(`${EMPLOYEE_ROOT_URL}/employees/${responsibleAgentId}/termin`, {
        participantid: customerNumber,
        todo: 'fill with something',
        start: nextFreeMeetingTime,
        end: nextFreeMeetingTime.clone().add(30, 'm'),
      }).catch(error => reject(Error(error)));
    }
    // create new output text
    const outText = message.output.text[0].replace(/\$\[call_date\]/i, `${nextFreeMeetingTime.get('date')}.${nextFreeMeetingTime.get('month') + 1}.${nextFreeMeetingTime.get('year')}`).replace(/\$\[call_time\]/i, `${nextFreeMeetingTime.get('hours')}:${nextFreeMeetingTime.get('minutes')}`);
      // add new Text to message
    outMessage.output.text.unshift(outText);
      // add responsibleAgentId to context
   // console.log('DATEOUT:', outMessage);
    resolve(outMessage);
  }).catch(error => reject(Error(error)));
});


// This agent takes a userid and finds the responsible agent
const employeeAgent = message => new Promise((resolve, reject) => {
  // idea give other agents the possibility to indicate to other agents
  // that some action is needed in context
  // console.log('EMLOYEEIN:', JSON.stringify(message));
  if (message.isArray || typeof (message.context.userId) === 'undefined' || !/\$\[call_agent\]/i.test(message.output.text[0])) {
    reject('Nothing to do for employee agent.');
    // return console.log('Agentstate: Nothing to do for employee agent.');
  }
  const customerNumber = message.context.userId;
  const outMessage = message;
  axios.get(`${CUSTOMER_ROOT_URL}/customers/${customerNumber}`)
  .then((customerRecord) => {
    const responsibleAgentId = customerRecord.data.customer.centralagentid;
    axios.get(`${EMPLOYEE_ROOT_URL}/employees/${responsibleAgentId}`)
    .then((employeeRecord) => {
      const employee = employeeRecord.data.employee;
      // create new output text
      const outText = message.output.text[0].replace(/\$\[call_agent\]/i, employee.name);
      // add new Text to message
      outMessage.output.text.unshift(outText);
      // add responsibleAgentId to context
      outMessage.context.responsibleAgentId = responsibleAgentId;
      resolve(outMessage);
    });
  }).catch(error => reject(Error(error)));
});

const createAgentArray = message => [employeeAgent(message), dateAgent(message)];

const callAgents = (message, io) => {
  Promise.any(createAgentArray(message)).then((outMessage) => {
    if (/\$\[/.test(outMessage.output.text[0])) {
      callAgents(createAgentArray(outMessage), io);
    } else {
      return outMessage;
    }
  }).then((outMessage) => {
    console.log(outMessage);
    io.emit('bot-message', {
      role: 'bot',
      text: outMessage.output.text[0],
      timestamp: Date.now(),
    });
  })
  .catch(error => console.log('Error:', error));
};

module.exports = {
  dateAgent,
  employeeAgent,
  callAgents,
};
