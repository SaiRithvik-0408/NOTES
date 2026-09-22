// Client-side Chess Multiplayer Hub: WebSocket + BroadcastChannel Hybrid

import { Move, PieceColor, ChessSocketMessage } from './chessTypes';

export type MessageHandler = (msg: ChessSocketMessage) => void;

export class ChessMultiplayerManager {
  private ws: WebSocket | null = null;
  private channel: BroadcastChannel | null = null;
  private roomId: string | null = null;
  private playerId: string;
  private myColor: PieceColor = 'w';
  private handlers: Set<MessageHandler> = new Set();
  private isConnected = false;

  constructor() {
    this.playerId = `player-${Math.random().toString(36).substring(2, 9)}`;
  }

  public init(roomId: string, myColor: PieceColor = 'w'): void {
    this.disconnect();
    this.roomId = roomId;
    this.myColor = myColor;

    // 1. Local BroadcastChannel for seamless instant multi-tab testing
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(`nexus_chess_${roomId}`);
        this.channel.onmessage = (event) => {
          if (event.data && event.data.playerId !== this.playerId) {
            this.notifyHandlers(event.data);
          }
        };
      } catch (err) {
        console.warn('[ChessMultiplayer] BroadcastChannel unavailable:', err);
      }
    }

    // 2. Remote WebSocket for cross-network multiplayer
    this.connectWebSocket();
  }

  private connectWebSocket() {
    try {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const wsProto = isHttps ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${wsProto}//${host}/ws`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.send({
          type: 'chess_join',
          roomId: this.roomId!,
          color: this.myColor,
          playerId: this.playerId,
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.roomId === this.roomId && data.playerId !== this.playerId) {
            this.notifyHandlers(data);
          }
        } catch {
          // Ignore non-json
        }
      };

      this.ws.onerror = () => {
        // Fallback to BroadcastChannel
        this.isConnected = false;
      };

      this.ws.onclose = () => {
        this.isConnected = false;
      };
    } catch (err) {
      console.warn('[ChessMultiplayer] WebSocket setup error:', err);
    }
  }

  public send(msg: ChessSocketMessage): void {
    // Send via BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch {}
    }

    // Send via WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch {}
    }
  }

  public sendMove(move: Move, nextTurn: PieceColor): void {
    if (!this.roomId) return;
    this.send({
      type: 'chess_move',
      roomId: this.roomId,
      move,
      turn: nextTurn,
      playerId: this.playerId,
    });
  }

  public sendReset(): void {
    if (!this.roomId) return;
    this.send({
      type: 'chess_reset',
      roomId: this.roomId,
      playerId: this.playerId,
    });
  }

  public subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private notifyHandlers(msg: ChessSocketMessage) {
    this.handlers.forEach((fn) => fn(msg));
  }

  public disconnect(): void {
    if (this.channel) {
      try {
        this.channel.close();
      } catch {}
      this.channel = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.handlers.clear();
    this.roomId = null;
    this.isConnected = false;
  }

  public getPlayerId(): string {
    return this.playerId;
  }
}

export const chessMultiplayer = new ChessMultiplayerManager();
