import { WebSocketServer, WebSocket } from 'ws';

interface CustomWebSocket extends WebSocket {
  locationId?: string;
}

export const setupWebSocketServer = (server: any) => {
  const wss = new WebSocketServer({ server });
  console.log('WebSocket server is running and listening for connections'); 

  wss.on('connection', (ws: CustomWebSocket, req) => {
    const params = new URLSearchParams(req.url?.split('?')[1]);
    const locationId = params.get('locationId');
    console.log('WebSocket connection request:', req.url);
  
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
    
    ws.on('error', (error) => {
      console.error(`WebSocket error for location: ${ws.locationId}`, error);
    });
  
    ws.on('close', (code, reason) => {
      console.log(`WebSocket connection closed for location: ${locationId}, Code: ${code}, Reason: ${reason}`);
      clearInterval(interval);
    });
  });
  

  return wss;
};
