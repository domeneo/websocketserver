       // {"type":"setid","clientid":"4000"}

      //  {"type":"dm","msg":"notify","targetid":"admin"}

const fs = require('fs');
const https = require('https');
const http = require('http'); // Import HTTP for non-SSL server
const WebSocket = require('ws');

// SSL configurations for each WebSocket server
const sslConfigs = [
  {
    port: 4000,
    cert: fs.readFileSync('./ssl/swan.crt'),
    key: fs.readFileSync('./ssl/swan.key'),
  },
  {
    port: 4001,
    cert: fs.readFileSync('./ssl/public.crt'),
    key: fs.readFileSync('./ssl/public.key'),
  }
];

// Function to create WebSocket server with a specific SSL config
function createWebSocketServer({ port, cert, key }) {
  // Create an HTTPS server with the specific SSL certificate
  const server = https.createServer({ cert, key });

  // Create a WebSocket server on top of the HTTPS server
  const wss = new WebSocket.Server({ server });

  // Map to store clients by clientid for this WebSocket server
  let clients = [];

  wss.on('connection', (ws) => {
    let clientid;

    // Handle messages from the client
    ws.on('message', (message) => {
      try{
      const parsedMessage = JSON.parse(message);
      
      // Check if the message contains a clientid assignment
      if (parsedMessage.type === 'setid') {
        clientid = parsedMessage.clientid;
        
        var client={'clientid':clientid,'ws':ws}
        clients.push(client);

        console.log(`Client connected on port ${port} with ID: ${clientid}`);
        

        clients.forEach((value) => 
          console.log(`id= ${value.clientid} `)
        );



        // Send a confirmation back to the client
        ws.send(JSON.stringify({ type: 'confirmation', msg: `clientid set to ${clientid}` }));
        
      } else if (parsedMessage.type === 'bc') {
        // Broadcast message to all clients on this server
        broadcast(parsedMessage.msg, clientid, clients);
        
      } else if (parsedMessage.type === 'dm' && parsedMessage.targetid) {
        // Send a direct message to a specific clientid on this server
        sendDirectMessage(parsedMessage.msg, parsedMessage.targetid, clients);
      }
    } catch(e) {
      console.log(e);
      // [Error: Uh oh!]
  }}
    );

    // Handle client disconnection
    ws.on('close', () => {
      console.log(`Client disconnected on port ${port}: ${clientid}`);
      //clients.delete(clientid); // Remove the client from the map

      clients = clients.filter(client => client.clientid != clientid);

    });
  });

  // Start the HTTPS server on the specified port
  server.listen(port, () => {
    console.log(`WebSocket server running on wss://localhost:${port}`);
  });
}

// Function to create a non-SSL WebSocket server
function createHttpWebSocketServer(port) {
  // Create an HTTP server for non-SSL connections
  const server = http.createServer();

  // Create a WebSocket server on top of the HTTP server
  const wss = new WebSocket.Server({ server });

  // Map to store clients by clientid for this WebSocket server
  //const clients = new Map();
  let clients = [];
  wss.on('connection', (ws) => {
    let clientid;

    // Handle messages from the client
    ws.on('message', (message) => {
      try {

      const parsedMessage = JSON.parse(message);
      
      // Check if the message contains a clientid assignment
      if (parsedMessage.type === 'setid') {
        clientid = parsedMessage.clientid; // + ":" + Date.now();
        
        var client={'clientid':clientid,'ws':ws}
        clients.push(client);
       // clients.set(clientid, ws);
        console.log(`Client connected on HTTP port ${port} with ID: ${clientid}`);


 
        clients.forEach((value) => 
          console.log(`id= ${value.clientid} `)
        );

        
        // Send a confirmation back to the client
        ws.send(JSON.stringify({ type: 'confirmation', message: `clientid set to ${clientid}` }));
        
      } else if (parsedMessage.type === 'bc') {
        // Broadcast message to all clients on this server
        broadcast(parsedMessage.message, clientid, clients);
        
      } else if (parsedMessage.type === 'dm' && parsedMessage.targetid) {
        // Send a direct message to a specific clientid on this server
        sendDirectMessage(parsedMessage.message, parsedMessage.targetid, clients);
      }
    }catch(e) {
      console.log(e);
      // [Error: Uh oh!]
  }
    });

    // Handle client disconnection
    ws.on('close', () => {
      console.log(`Client disconnected on HTTP port ${port}: ${clientid}`);
     // clients.delete(clientid); // Remove the client from the map
     clients = clients.filter(client => client.clientid != clientid);
    });
  });

  // Start the HTTP server on the specified port
  server.listen(port, () => {
    console.log(`WebSocket server running on ws://localhost:${port}`);
  });
}

// Helper function to broadcast a message to all clients on the specific server
function broadcast(message, senderId, clients) {
  // for (const [id, clientWs] of clients.entries()) {
  //   if (id !== senderId && clientWs.readyState === WebSocket.OPEN) {
  //     clientWs.send(JSON.stringify({ type: 'bc',msg: message, from: senderId }));
  //   }
  // }


  clients.forEach((value) => {
    if (value.clientid !== senderId && value.ws.readyState === WebSocket.OPEN) {
      value.ws.send(JSON.stringify({ type: 'bc',msg: message, from: senderId }));
    }}
  );


}

// Helper function to send a direct message to a specific clientid on the specific server
function sendDirectMessage(message, targetid, clients) {

  for (const [id, clientWs] of clients.entries()) {
    console.log(`id= ${id} `);
    }


    clients.forEach((value) => {
      console.log(`id= ${value.clientid} `);
      if(value.clientid==targetid)
      {
        const targetClient = value.ws;
        if (targetClient ) {
          if(targetClient.readyState === WebSocket.OPEN)
          {
            targetClient.send(JSON.stringify({ type: 'dm',msg:message}));
          }else{
            console.log(`Client with ID ${targetid}  not connected`);
          }
      
        } else {
          console.log(`Client with ID ${targetid} not found`);
        }
        
      

      }
    });

      



}

// Initialize WebSocket servers for each SSL config
sslConfigs.forEach(createWebSocketServer);

// Initialize a non-SSL WebSocket server on a specified port
createHttpWebSocketServer(4002); // Example port for non-SSL WebSocket server
