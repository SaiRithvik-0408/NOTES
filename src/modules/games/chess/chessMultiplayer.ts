// Client-side Chess Multiplayer Hub: WebSocket + BroadcastChannel Hybrid
// Supports 2 Players (White/Black), Spectator Mode, Presence Sync, and Seat Requests

import {
  Move,
  PieceColor,
  ChessPlayerRole,
  ChessParticipant,
  ChessRoomPresence,
  ChessSocketMessage,
} from './chessTypes';

export type MessageHandler = (msg: ChessSocketMessage) => void;

export class ChessMultiplayerManager {
  private ws: WebSocket | null = null;
  private channel: BroadcastChannel | null = null;
  private roomId: string | null = null;
  private playerId: string;
  private playerName: string = 'Player';
  private playerEmail?: string;
  private myRole: ChessPlayerRole = 'w';
  private handlers: Set<MessageHandler> = new Set();
  private isConnected = false;

  private presence: ChessRoomPresence = {
    whitePlayer: null,
    blackPlayer: null,
    spectators: [],
  };

  constructor() {
    this.playerId = `player-${Math.random().toString(36).substring(2, 9)}`;
  }

  public init(
    roomId: string,
    role: ChessPlayerRole = 'w',
    playerName: string = 'Player',
    playerEmail?: string
  ): void {
    this.disconnect();
    this.roomId = roomId;
    this.myRole = role;
    this.playerName = playerName;
    this.playerEmail = playerEmail;

    // Reset presence with self
    const me: ChessParticipant = {
      id: this.playerId,
      name: this.playerName,
      email: this.playerEmail,
      role: this.myRole,
      joinedAt: Date.now(),
    };

    this.presence = {
      whitePlayer: role === 'w' ? me : null,
      blackPlayer: role === 'b' ? me : null,
      spectators: role === 'spectator' ? [me] : [],
    };

    // 1. Local BroadcastChannel for seamless instant multi-tab testing
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(`nexus_chess_${roomId}`);
        this.channel.onmessage = (event) => {
          if (event.data && event.data.playerId !== this.playerId) {
            this.handleIncomingMessage(event.data);
          }
        };
      } catch (err) {
        console.warn('[ChessMultiplayer] BroadcastChannel unavailable:', err);
      }
    }

    // 2. Remote WebSocket for cross-network multiplayer
    this.connectWebSocket();

    // Broadcast self-join
    this.broadcastJoin();
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
        this.broadcastJoin();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.roomId === this.roomId && data.playerId !== this.playerId) {
            this.handleIncomingMessage(data);
          }
        } catch {
          // Ignore non-json
        }
      };

      this.ws.onerror = () => {
        this.isConnected = false;
      };

      this.ws.onclose = () => {
        this.isConnected = false;
      };
    } catch (err) {
      console.warn('[ChessMultiplayer] WebSocket setup error:', err);
    }
  }

  private broadcastJoin() {
    if (!this.roomId) return;
    this.send({
      type: 'chess_join',
      roomId: this.roomId,
      color: this.myRole,
      playerId: this.playerId,
      playerName: this.playerName,
      playerEmail: this.playerEmail,
    });
  }

  private handleIncomingMessage(msg: ChessSocketMessage) {
    if (msg.type === 'chess_join') {
      const newParticipant: ChessParticipant = {
        id: msg.playerId,
        name: msg.playerName || 'Challenger',
        email: msg.playerEmail,
        role: msg.color,
        joinedAt: Date.now(),
      };

      // Add to presence
      if (msg.color === 'w') {
        this.presence.whitePlayer = newParticipant;
      } else if (msg.color === 'b') {
        this.presence.blackPlayer = newParticipant;
      } else {
        if (!this.presence.spectators.some((s) => s.id === msg.playerId)) {
          this.presence.spectators.push(newParticipant);
        }
      }

      // Respond with presence state
      this.send({
        type: 'chess_presence',
        roomId: this.roomId!,
        presence: this.presence,
        playerId: this.playerId,
      });

      // Also send peer joined
      this.send({
        type: 'chess_peer_joined',
        roomId: this.roomId!,
        color: this.myRole,
        playerId: this.playerId,
        playerName: this.playerName,
        playerEmail: this.playerEmail,
      });
    } else if (msg.type === 'chess_presence') {
      // Merge presence
      const remote = msg.presence;
      if (remote.whitePlayer && !this.presence.whitePlayer) {
        this.presence.whitePlayer = remote.whitePlayer;
      }
      if (remote.blackPlayer && !this.presence.blackPlayer) {
        this.presence.blackPlayer = remote.blackPlayer;
      }
      remote.spectators.forEach((spec) => {
        if (!this.presence.spectators.some((s) => s.id === spec.id)) {
          this.presence.spectators.push(spec);
        }
      });
    } else if (msg.type === 'chess_seat_approved' && msg.playerId === this.playerId) {
      // Promoted to active player!
      this.myRole = msg.assignedRole;
    }

    this.notifyHandlers(msg);
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
    if (!this.roomId || this.myRole === 'spectator') return;
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

  public requestSeat(requestedRole: 'w' | 'b' | 'any' = 'any'): void {
    if (!this.roomId) return;
    this.send({
      type: 'chess_request_seat',
      roomId: this.roomId,
      playerId: this.playerId,
      playerName: this.playerName,
      playerEmail: this.playerEmail,
      requestedRole,
    });
  }

  public approveSeat(targetPlayerId: string, assignedRole: PieceColor): void {
    if (!this.roomId) return;
    this.send({
      type: 'chess_seat_approved',
      roomId: this.roomId,
      playerId: targetPlayerId,
      assignedRole,
    });
  }

  public setRole(role: ChessPlayerRole): void {
    this.myRole = role;
  }

  public getRole(): ChessPlayerRole {
    return this.myRole;
  }

  public isSpectator(): boolean {
    return this.myRole === 'spectator';
  }

  public getPresence(): ChessRoomPresence {
    return this.presence;
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
    this.presence = {
      whitePlayer: null,
      blackPlayer: null,
      spectators: [],
    };
  }

  public getPlayerId(): string {
    return this.playerId;
  }
}

export const chessMultiplayer = new ChessMultiplayerManager();
