import { WebSocketServer, WebSocket } from 'ws';

interface CustomWebSocket extends WebSocket {
  locationId?: string;
}

export const setupWebSocketServer = (server: any) => {
  const wss = new WebSocketServer({ port: 5002 });
  console.log('WebSocket server is running on ws://localhost:5002'); 

  wss.on('headers', (headers) => {
    headers.push('Access-Control-Allow-Origin: *');
  });

  wss.on('connection', (ws: CustomWebSocket, req) => {
    console.log('WebSocket connection request:', req.url);
    const params = new URLSearchParams(req.url?.split('?')[1]);
    const locationId = params.get('locationId');
  
    if (!locationId) {
      console.log('Connection rejected: Missing locationId');
      ws.close(1008, 'Missing locationId');
      return;
    }
  
    ws.locationId = locationId;
    console.log(`Connection established for location: ${locationId}`);
  
    // Keep connection alive with pings
    // const interval = setInterval(() => {
    //   if (ws.readyState === WebSocket.OPEN) {
    //     ws.ping();
    //   } else {
    //     clearInterval(interval);
    //   }
    // }, 30000);
  
    // ws.on('pong', () => {
    //   console.log(`Pong received for location: ${locationId}`);
    // });
  
    ws.on('message', (message) => {
      console.log(`Message received for location ${locationId}:`, message.toString());
      try {
        const parsedMessage = JSON.parse(message.toString());
        // Broadcast to all clients in the same location
        wss.clients.forEach((client) => {
          const customClient = client as CustomWebSocket;
          if (customClient.readyState === WebSocket.OPEN && customClient.locationId === locationId) {
            customClient.send(JSON.stringify(parsedMessage));
          }
        });
      } catch (error) {
        console.error('Error processing message:', error);
        ws.send(JSON.stringify({ error: 'Invalid message format' }));
      }
    });
  
    ws.on('close', (code, reason) => {
      const reasonStr = reason.toString('utf-8');
      console.log(`Connection closed for location: ${locationId}, Code: ${code}, Reason: ${reasonStr}`);
      // clearInterval(interval);
    });
  
    ws.on('error', (error) => {
      console.error(`Error for location ${locationId}:`, error?.message);
    });
  });
  
  return wss;
};
