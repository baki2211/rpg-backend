import { WebSocketServer, WebSocket } from 'ws';

interface CustomWebSocket extends WebSocket {
  locationId?: string;
}

export const setupWebSocketServer = (server: any) => {
  const wss = new WebSocketServer({ port: 5002 });
  console.log('WebSocket server is running and listening for connections on ws://localhost:5002'); 

  wss.on('headers', (headers) => {
    headers.push('Access-Control-Allow-Origin: *');
  });

  wss.on('connection', (ws: CustomWebSocket, req) => {
    console.log('WebSocket connection request:', req.url);
    const params = new URLSearchParams(req.url?.split('?')[1]);
    const locationId = params.get('locationId');
  
    if (!locationId) {
      console.log('WebSocket connection rejected: Missing locationId');
      ws.close(1008, 'Missing locationId');
      return;
    }
  
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
    
    ws.on('close', (code, reason) => {
      console.log(typeof code);
      
      console.log(`WebSocket closed. Code: ${code}, Reason: ${reason || 'No reason provided'}`);
      clearInterval(interval);
  });
  
  ws.on('error', (error) => {
      console.error(`WebSocket error for location ${ws.locationId}:`, error);
  });
  });
  

  return wss;
};
