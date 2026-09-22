import { useState, useEffect, useRef, useCallback } from 'react';

export interface CollaboratorPeer {
  clientId: string;
  userId: string;
  userName: string;
  userColor?: string;
  userAvatar?: string;
  activeNoteId: string;
  isEditing?: boolean;
  lastSeen: number;
}

export interface UseNotePresenceReturn {
  activePeers: CollaboratorPeer[];
  broadcastEditing: (isEditing: boolean) => void;
}

/**
 * Real-time Collaborator Presence Hook
 * Hybrid WebSocket + BroadcastChannel peer-to-peer presence manager
 */
export function useNotePresence(
  noteId: string | null,
  currentUser: any
): UseNotePresenceReturn {
  const [activePeers, setActivePeers] = useState<CollaboratorPeer[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const myClientIdRef = useRef<string>(`peer-${Math.random().toString(36).substring(2, 8)}`);
  const isEditingRef = useRef<boolean>(false);

  const userId = currentUser?.id || `guest-${myClientIdRef.current}`;
  const userName = currentUser?.name || 'Guest Contributor';
  const userColor = currentUser?.color || '#6366F1';
  const userAvatar = currentUser?.avatarUrl || '';

  // Broadcast current presence state to both WebSocket and BroadcastChannel
  const sendPresencePing = useCallback(
    (isEditingState?: boolean) => {
      if (!noteId) return;

      const editing = isEditingState !== undefined ? isEditingState : isEditingRef.current;
      const payload = {
        type: 'presence',
        clientId: myClientIdRef.current,
        userId,
        userName,
        userColor,
        userAvatar,
        activeNoteId: noteId,
        isEditing: editing,
        timestamp: Date.now(),
      };

      // 1. Send to WebSocket if connected
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      }

      // 2. Send to BroadcastChannel for local cross-tab play
      if (bcRef.current) {
        bcRef.current.postMessage(payload);
      }
    },
    [noteId, userId, userName, userColor, userAvatar]
  );

  const broadcastEditing = useCallback(
    (isEditing: boolean) => {
      isEditingRef.current = isEditing;
      sendPresencePing(isEditing);
    },
    [sendPresencePing]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !noteId) return;

    // 1. Initialize BroadcastChannel
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('nexus_note_presence');
      bc.onmessage = (event) => {
        handleIncomingPresence(event.data);
      };
      bcRef.current = bc;
    }

    // 2. Initialize WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '5173' ? 'localhost:3001' : window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        sendPresencePing();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'presence' || data.type === 'presence_update') {
            handleIncomingPresence(data);
          } else if (data.type === 'peer_disconnected') {
            setActivePeers((prev) => prev.filter((p) => p.clientId !== data.clientId));
          }
        } catch {
          // Ignore parse errors
        }
      };

      wsRef.current = ws;
    } catch {
      // WebSocket optional
    }

    // Periodic heartbeat every 8 seconds
    sendPresencePing();
    const heartbeatTimer = setInterval(() => {
      sendPresencePing();
      // Prune stale peers inactive for > 20s
      setActivePeers((prev) => prev.filter((p) => Date.now() - p.lastSeen < 20000));
    }, 8000);

    return () => {
      clearInterval(heartbeatTimer);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // Ignore
        }
        wsRef.current = null;
      }
      if (bcRef.current) {
        bcRef.current.close();
        bcRef.current = null;
      }
      setActivePeers([]);
    };
  }, [noteId, sendPresencePing]);

  const handleIncomingPresence = (data: any) => {
    if (!data || data.clientId === myClientIdRef.current) return;
    if (data.activeNoteId !== noteId) {
      // Peer switched to another note; remove from this note
      setActivePeers((prev) => prev.filter((p) => p.clientId !== data.clientId));
      return;
    }

    const peer: CollaboratorPeer = {
      clientId: data.clientId,
      userId: data.userId,
      userName: data.userName || 'Guest Contributor',
      userColor: data.userColor || '#6366F1',
      userAvatar: data.userAvatar,
      activeNoteId: data.activeNoteId,
      isEditing: Boolean(data.isEditing),
      lastSeen: Date.now(),
    };

    setActivePeers((prev) => {
      const idx = prev.findIndex((p) => p.clientId === peer.clientId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = peer;
        return copy;
      }
      return [...prev, peer];
    });
  };

  return {
    activePeers,
    broadcastEditing,
  };
}
