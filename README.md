# Backend Service Schedulebot

This is the backend for the Schedule-Bot that exposes APIs to: 
- Push information to a customer: e.g. his contract data has been changed. 
- Lets the customer send messages
- Identifies the Intents and Entities of a customer
- Based on his intent and entities it responses with a time an agent will call the customer
  - priority has the responsible agent if he is not available find a responsible agent like him 
- Let the customer reschedule. 
- Identify that it is no general question but a complaint or an issue related to a contract and do the calculation based on the agent specified in the contract



Technology: 
- NodeJS
- SocketIO
- REST (axios)