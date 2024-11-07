const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
//const server = new WebSocket.Server({ port: 4000 });
  debugger;
// Load SSL certificates
const server = https.createServer({
  cert: fs.readFileSync('./ssl/swan.crt'),
  key: fs.readFileSync('./ssl/swan.key')
});

// Set up the WebSocket server
const wss = new WebSocket.Server({ server });



// Listen for connection events
wss.on('connection', (ws) => {
    console.log('New client connected');

    // Listen for messages from a client
    ws.on('message', (data) => {
        console.log('Received:', data);

        // Broadcast message to all other connected clients
        ws.clients.forEach((client) => {
            // Ensure the client is open and not the sender
            if (client !== socket && client.readyState === WebSocket.OPEN) {
                client.send(data.toString('utf-8'));
            }
        });
    });

    // Listen for disconnection
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Start the server on a specific port
server.listen(8080, () => {
  console.log('WebSocket server running on wss://localhost:4000');
});

