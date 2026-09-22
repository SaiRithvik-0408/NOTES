import http from 'http';
import { app } from './app';
import { setupWebSocketServer } from './websocket';

const PORT = process.env.PORT || 3001;
const server = http.createServer(app);
setupWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`🚀 Nexus Notes backend server listening on http://localhost:${PORT}`);
});

export { app, server };
export default app;
