import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface ClientConnection {
  ws: WebSocket;
  clientId: string;
  userId?: string;
  userName?: string;
  activeNoteId?: string;
}

export function setupWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Map<WebSocket, ClientConnection>();

  wss.on('connection', (ws: WebSocket) => {
    const conn: ClientConnection = {
      ws,
      clientId: `client-${Math.random().toString(36).substring(2, 9)}`,
    };
    clients.set(ws, conn);

    // Send connection handshake
    ws.send(
      JSON.stringify({
        type: 'handshake',
        clientId: conn.clientId,
        timestamp: new Date().toISOString(),
      })
    );

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'presence') {
          conn.userId = data.userId;
          conn.userName = data.userName;
          conn.activeNoteId = data.activeNoteId;

          // Broadcast presence update to all other connected clients
          broadcastToOthers(ws, {
            type: 'presence_update',
            clientId: conn.clientId,
            ...data,
          });
        } else if (data.type === 'crdt_sync') {
          // Broadcast CRDT Y.Doc binary or JSON patch to peers in the same note room
          broadcastToOthers(ws, data);
        } else if (data.type === 'mutation_broadcast') {
          broadcastToOthers(ws, data);
        } else if (
          typeof data.type === 'string' &&
          data.type.startsWith('chess_')
        ) {
          // Broadcast chess multiplayer event to peers
          broadcastToOthers(ws, data);
        }
      } catch (err) {
        console.error('[WebSocket] Failed to parse message:', err);
      }
    });

    ws.on('close', () => {
      // Notify peers that this user disconnected
      broadcastToOthers(ws, {
        type: 'peer_disconnected',
        clientId: conn.clientId,
        userId: conn.userId,
      });
      clients.delete(ws);
    });
  });

  function broadcastToOthers(senderWs: WebSocket, payload: any) {
    const messageStr = JSON.stringify(payload);
    for (const [clientWs] of clients) {
      if (clientWs !== senderWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(messageStr);
      }
    }
  }

  return wss;
}
