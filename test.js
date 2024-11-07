const fs = require('fs');
const https = require('https');
const http = require('http');
const WebSocket = require('ws');
const redis = require('redis');

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

// Maps to keep track of clients on each WebSocket server
const sslServerClients = new Map();
const httpServerClients = new Map();

// Create Redis client instances with auto-reconnect options
function createRedisClient() {
    const client = redis.createClient({
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          console.error('Redis server refused the connection');
          return new Error('The Redis server refused the connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      },
    });
  
    client.on('error', (err) => console.error('Redis Client Error:', err));
    client.on('connect', () => console.log('Redis Client connected'));
    client.on('reconnecting', () => console.log('Redis Client reconnecting...'));
    client.on('end', () => console.log('Redis Client connection closed'));
  
    return client;
  }
  
  // Create the publisher and subscriber Redis clients
  let redisPublisher = createRedisClient();
  let redisSubscriber = createRedisClient();
  
  // Subscribe to Redis channel for cross-server messaging
  redisSubscriber.subscribe('direct_message_channel', (err) => {
    if (err) {
      console.error('Redis Subscriber subscribe error:', err);
    }
  });
  
  redisSubscriber.on('message', (channel, message) => {
    const { targetid, msg, fromPort } = JSON.parse(message);
  
    // Check if this server has the client
    const targetClient = clients.get(targetid);
    if (targetClient && targetClient.readyState === WebSocket.OPEN) {
      targetClient.send(JSON.stringify({ type: 'dm', msg, fromPort }));
    }
  });
  
  // Helper function to publish with connection check
  function publishMessage(channel, message) {
    if (!redisPublisher || !redisPublisher.connected) {
      console.warn('Redis publisher is closed or disconnected. Reinitializing...');
      redisPublisher = createRedisClient();
    }
  
    try {
      redisPublisher.publish(channel, message);
    } catch (err) {
      console.error('Failed to publish message to Redis:', err);
    }
  }
  
  // Modified sendDirectMessage function with Redis reconnect handling
  function sendDirectMessage(message, targetid, clients, fromPort) {
    const targetClient = clients.get(targetid);
  
    if (targetClient && targetClient.readyState === WebSocket.OPEN) {
      targetClient.send(JSON.stringify({ type: 'dm', msg: message, fromPort }));
    } else {
      // Publish to Redis with connection check if the client is on a different port/server
      publishMessage('direct_message_channel', JSON.stringify({ targetid, msg: message, fromPort }));
    }
  }

// Function to create WebSocket server with a specific SSL config
function createWebSocketServer({ port, cert, key }) {
  const server = https.createServer({ cert, key });
  const wss = new WebSocket.Server({ server });
  const clients = new Map(); // Store clients by clientid for this server

  sslServerClients.set(port, clients); // Keep track of each server's clients

  wss.on('connection', (ws) => {
    let clientid;

    ws.on('message', (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        
        if (parsedMessage.type === 'setid') {
          clientid = parsedMessage.clientid;
          clients.set(clientid, ws);
          console.log(`Client connected on port ${port} with ID: ${clientid}`);

          ws.send(JSON.stringify({ type: 'confirmation', msg: `clientid set to ${clientid}` }));
        } else if (parsedMessage.type === 'bc') {
          broadcast(parsedMessage.msg, clientid, clients);
        } else if (parsedMessage.type === 'dm' && parsedMessage.targetid) {
          sendDirectMessage(parsedMessage.msg, parsedMessage.targetid, clients, port);
        }
      } catch (e) {
        console.log(e);
      }
    });

    ws.on('close', () => {
      console.log(`Client disconnected on port ${port}: ${clientid}`);
      clients.delete(clientid);
    });
  });

  server.listen(port, () => {
    console.log(`WebSocket server running on wss://localhost:${port}`);
  });
}

// Function to create a non-SSL WebSocket server
function createHttpWebSocketServer(port) {
  const server = http.createServer();
  const wss = new WebSocket.Server({ server });
  const clients = new Map(); // Store clients by clientid for this server

  httpServerClients.set(port, clients); // Keep track of each server's clients

  wss.on('connection', (ws) => {
    let clientid;

    ws.on('message', (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        
        if (parsedMessage.type === 'setid') {
          clientid = parsedMessage.clientid;
          clients.set(clientid, ws);
          console.log(`Client connected on HTTP port ${port} with ID: ${clientid}`);

          ws.send(JSON.stringify({ type: 'confirmation', msg: `clientid set to ${clientid}` }));
        } else if (parsedMessage.type === 'bc') {
          broadcast(parsedMessage.msg, clientid, clients);
        } else if (parsedMessage.type === 'dm' && parsedMessage.targetid) {
          sendDirectMessage(parsedMessage.msg, parsedMessage.targetid, clients, port);
        }
      } catch (e) {
        console.log(e);
      }
    });

    ws.on('close', () => {
      console.log(`Client disconnected on HTTP port ${port}: ${clientid}`);
      clients.delete(clientid);
    });
  });

  server.listen(port, () => {
    console.log(`WebSocket server running on ws://localhost:${port}`);
  });
}

// Helper function to broadcast a message to all clients on the specific server
function broadcast(message, senderId, clients) {
  for (const [id, clientWs] of clients.entries()) {
    if (id !== senderId && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: 'bc', msg: message, from: senderId }));
    } else if (clientWs.readyState !== WebSocket.OPEN) {
      // Remove closed connections to avoid errors
      clients.delete(id);
    }
  }
}

// Initialize WebSocket servers for each SSL config
sslConfigs.forEach(createWebSocketServer);

// Initialize a non-SSL WebSocket server on a specified port
createHttpWebSocketServer(4002); // Example port for non-SSL WebSocket server
