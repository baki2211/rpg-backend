import { WebSocketServer, WebSocket } from 'ws';

interface CustomWebSocket extends WebSocket {
  current: any;
  locationId?: string;
}

export const setupWebSocketServer = (server: any) => {
  const wss = new WebSocketServer({ port: 5002 });
  console.log('WebSocket server is running and listening for connections on ws://localhost:5002'); 

  wss.on('headers', (headers) => {
    headers.push('Access-Control-Allow-Origin: *');
  });

  const clientsPerLocation: Record<string, Set<WebSocket>> = {};

  wss.on('connection', (ws: CustomWebSocket, req) => {
    console.log('WebSocket connection request:', req.url);
    const params = new URLSearchParams(req.url?.split('?')[1]);
    const locationId = params.get('locationId');
  
    if (!locationId) {
      console.log('WebSocket connection rejected: Missing locationId');
      ws.close(1008, 'Missing locationId');
      return;
    }

     // Initialize the client set for this location
    if (!clientsPerLocation[locationId]) {
      clientsPerLocation[locationId] = new Set();
    }

    clientsPerLocation[locationId].add(ws);
  
    ws.locationId = locationId;
    console.log(`WebSocket connection established for location: ${locationId}`);
  
      // Keep connection alive with ping/pong
      const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping(); // Send ping to the client
        } else {
            clearInterval(interval);
        }
      }, 30000);
  
      ws.on('pong', () => {
        console.log(`Pong received from client for location: ${locationId}`);
     });

    // Handle incoming messages from the client
    ws.on('message', (message) => {
      console.log(`Message received for location ${ws.locationId}:`, message.toString());

      try {
        // Parse and process the message if it's in JSON format
        const parsedMessage = JSON.parse(message.toString());
        console.log('Parsed Message:', parsedMessage);

        // Example: Broadcasting the message to all clients connected to the same location
        wss.clients.forEach((client) => {
          const customClient = client as CustomWebSocket;
          if (customClient.readyState === WebSocket.OPEN && customClient.locationId === ws.locationId) {
            customClient.send(JSON.stringify(parsedMessage)); // Send the message to all clients in the same location
          }
        });
      } catch (error) {
        console.error('Failed to process message:', error);
        ws.send(JSON.stringify({ error: 'Invalid message format' }));
        console.error('WebSocket error details:', {
          readyState: ws.current?.readyState,
          url: ws.current?.url,
        });
      }
    });

    ws.on('close', (code, reason) => {
      const reasonString = reason.toString('utf-8'); // Convert the Buffer to a readable string
      console.log(`WebSocket closed. Code: ${code}, Reason: ${reasonString || 'No reason provided'}`);
      // Remove the client from the location set
      clientsPerLocation[locationId].delete(ws);
        if (clientsPerLocation[locationId].size === 0) {
          delete clientsPerLocation[locationId];
        }
      clearInterval(interval);
    });
  
    ws.on('error', (error) => {
      console.error(`WebSocket error for location ${ws.locationId}:`, error?.message);
  
    });
  });

  return wss;
};
