import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  CircularProgress,
  Alert,
  TextField,
  Snackbar,
  Divider,
  Card,
  CardActionArea,
  CardContent,
  useTheme,
} from '@mui/material';
import {
  RotateLeft,
  Undo,
  PlayArrow,
  SmartToyOutlined,
  PersonOutline,
  VolumeUp,
  VolumeOff,
  ViewInAr,
  GridOn,
  AutoAwesome,
  SwapVert,
  LightbulbOutlined,
  TipsAndUpdates,
  PublicOutlined,
  ContentCopy,
  Check,
  LinkOutlined,
  AddCircleOutline,
  MeetingRoomOutlined,
  EmailOutlined,
  VisibilityOutlined,
  SportsEsportsOutlined,
  GroupOutlined,
  SendOutlined,
  Close,
  LockOutlined,
} from '@mui/icons-material';
import {
  AiDifficulty,
  Board,
  GameMode,
  GameState,
  Move,
  Piece,
  PieceColor,
  PieceType,
  Position,
  UITheme,
  ChessPlayerRole,
  ChessRoomPresence,
  ChessParticipant,
} from './chessTypes';
import {
  createInitialGameState,
  getLegalMoves,
  applyMove,
  isKingInCheck,
} from './chessEngine';
import { getBestMove } from './chessAi';
import { chessAudio } from './chessAudio';
import { chessMultiplayer } from './chessMultiplayer';
import { Chess2DView } from './Chess2DView';
import { Chess3DView } from './Chess3DView';
import { useAuth } from '../../auth/AuthContext';
import { AuthModal } from '../../auth/AuthModal';

const PIECE_VALUES: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const PIECE_SYMBOLS: Record<PieceColor, Record<string, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

function generateRoomCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const prefix = letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
}

export const ChessGame: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { currentUser } = useAuth();

  // Game Settings
  const [uiTheme, setUiTheme] = useState<UITheme>('3d-wood');
  const [gameMode, setGameMode] = useState<GameMode>('ai');
  const [difficulty, setDifficulty] = useState<AiDifficulty>('medium');
  const [isFlipped, setIsFlipped] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Game Engine State
  const [gameState, setGameState] = useState<GameState>(() => createInitialGameState());
  const [historyStack, setHistoryStack] = useState<GameState[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const aiThinkingRef = useRef(false);
  const [activeHint, setActiveHint] = useState<Move | null>(null);
  const [hintExplanation, setHintExplanation] = useState<string | null>(null);

  // Promotion Picker State
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Position;
    to: Position;
    piece: Piece;
    captured?: Piece | null;
  } | null>(null);

  // Online Multiplayer State
  const [onlineRoomId, setOnlineRoomId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const match = hash.match(/chess-room=([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room') || params.get('chess-room');
      if (roomParam) return roomParam;
    }
    return generateRoomCode();
  });

  const [myRole, setMyRole] = useState<ChessPlayerRole>('w');
  const [roomPresence, setRoomPresence] = useState<ChessRoomPresence>({
    whitePlayer: null,
    blackPlayer: null,
    spectators: [],
  });
  const [peerConnected, setPeerConnected] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Modals and Dialogs State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinInputCode, setJoinInputCode] = useState('');
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [pendingAcceptRoomId, setPendingAcceptRoomId] = useState<string | null>(null);

  // Create Room Configuration
  const [customRoomCode, setCustomRoomCode] = useState(() => generateRoomCode());
  const [selectedSide, setSelectedSide] = useState<'w' | 'b' | 'random'>('w');
  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Auth Dialog Gate
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authPromptReason, setAuthPromptReason] = useState<string | null>(null);

  // Toast / Feedback State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Calculate material difference
  const materialAdvantage = useMemo(() => {
    const whiteSum = gameState.capturedBlack.reduce((acc, p) => acc + PIECE_VALUES[p.type], 0);
    const blackSum = gameState.capturedWhite.reduce((acc, p) => acc + PIECE_VALUES[p.type], 0);
    return {
      whiteLead: whiteSum > blackSum ? whiteSum - blackSum : 0,
      blackLead: blackSum > whiteSum ? blackSum - whiteSum : 0,
    };
  }, [gameState.capturedBlack, gameState.capturedWhite]);

  // Last Move made
  const lastMove = useMemo(() => {
    if (gameState.moveHistory.length === 0) return null;
    return gameState.moveHistory[gameState.moveHistory.length - 1];
  }, [gameState.moveHistory]);

  // Sound triggers
  const triggerMoveSound = useCallback(
    (move: Move, isCheck: boolean, isCheckmate: boolean) => {
      if (!soundEnabled) return;
      if (isCheckmate) {
        chessAudio.playVictory();
      } else if (isCheck) {
        chessAudio.playCheck();
      } else if (move.captured) {
        chessAudio.playCapture();
      } else {
        chessAudio.playMove();
      }
    },
    [soundEnabled]
  );

  // Generate Invite URL
  const getInviteUrl = useCallback((room: string) => {
    if (typeof window === 'undefined') return '';
    const base = window.location.origin + window.location.pathname;
    return `${base}?view=games&game=chess&room=${room}#chess-room=${room}`;
  }, []);

  // Auto-detect invite link on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room') || params.get('chess-room');
      const match = hash.match(/chess-room=([a-zA-Z0-9_-]+)/);
      const detectedRoom = match ? match[1] : roomParam;

      if (detectedRoom) {
        setPendingAcceptRoomId(detectedRoom);
        setAcceptModalOpen(true);
      }
    }
  }, []);

  // Initialize Multiplayer Session
  const startMultiplayerSession = useCallback(
    (roomId: string, role: ChessPlayerRole) => {
      setOnlineRoomId(roomId);
      setMyRole(role);
      setGameMode('online');
      setIsFlipped(role === 'b');

      if (typeof window !== 'undefined') {
        window.location.hash = `#chess-room=${roomId}&role=${role}`;
      }

      const playerName = currentUser?.name || currentUser?.username || (role === 'spectator' ? 'Spectator' : 'Challenger');
      const playerEmail = currentUser?.email;

      chessMultiplayer.init(roomId, role, playerName, playerEmail);
      setRoomPresence(chessMultiplayer.getPresence());
    },
    [currentUser]
  );

  // Sync multiplayer socket & BroadcastChannel
  useEffect(() => {
    if (gameMode !== 'online') {
      chessMultiplayer.disconnect();
      return;
    }

    const unsubscribe = chessMultiplayer.subscribe((msg) => {
      if (msg.type === 'chess_move') {
        setHistoryStack((prev) => [...prev, gameState]);
        const nextState = applyMove(gameState, msg.move);
        setGameState(nextState);
        triggerMoveSound(msg.move, nextState.isCheck, nextState.isCheckmate);
      } else if (msg.type === 'chess_join') {
        setPeerConnected(true);
        setRoomPresence({ ...chessMultiplayer.getPresence() });
      } else if (msg.type === 'chess_presence') {
        setRoomPresence({ ...msg.presence });
      } else if (msg.type === 'chess_peer_joined') {
        setPeerConnected(true);
      } else if (msg.type === 'chess_reset') {
        setGameState(createInitialGameState());
        setHistoryStack([]);
      } else if (msg.type === 'chess_request_seat') {
        setToastMessage(`♟️ Spectator ${msg.playerName} requested to play the next match!`);
      } else if (msg.type === 'chess_seat_approved' && msg.playerId === chessMultiplayer.getPlayerId()) {
        setMyRole(msg.assignedRole);
        setIsFlipped(msg.assignedRole === 'b');
        setToastMessage(`🎉 You have been seated as ${msg.assignedRole === 'w' ? 'White' : 'Black'}!`);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [gameMode, gameState, triggerMoveSound]);

  // Automated AI bot move trigger
  useEffect(() => {
    if (gameMode !== 'ai') {
      aiThinkingRef.current = false;
      setIsAiThinking(false);
      return;
    }
    if (gameState.isCheckmate || gameState.isStalemate) {
      aiThinkingRef.current = false;
      setIsAiThinking(false);
      return;
    }

    // Check if it is the AI bot's turn
    const isBotTurn = gameState.turn !== myRole;
    if (!isBotTurn) {
      aiThinkingRef.current = false;
      setIsAiThinking(false);
      return;
    }

    if (aiThinkingRef.current) return;
    aiThinkingRef.current = true;
    setIsAiThinking(true);

    const thinkDelay = difficulty === 'hard' ? 500 : difficulty === 'medium' ? 350 : 250;
    const timer = setTimeout(() => {
      try {
        const best = getBestMove(gameState, difficulty);
        if (best) {
          setHistoryStack((prev) => [...prev, gameState]);
          const nextState = applyMove(gameState, best);
          setGameState(nextState);
          setActiveHint(null);
          setHintExplanation(null);
          triggerMoveSound(best, nextState.isCheck, nextState.isCheckmate);
        }
      } catch (err) {
        console.error('Chess AI move calculation failed:', err);
      } finally {
        aiThinkingRef.current = false;
        setIsAiThinking(false);
      }
    }, thinkDelay);

    return () => {
      clearTimeout(timer);
    };
  }, [gameMode, gameState, myRole, difficulty, triggerMoveSound]);

  // Handle Square Selection and Piece Movement
  const handleSelectSquare = useCallback(
    (pos: Position) => {
      if (isAiThinking || gameState.isCheckmate || gameState.isStalemate) return;
      if (gameMode === 'ai' && gameState.turn !== myRole) return;
      if (gameMode === 'online') {
        if (myRole === 'spectator') {
          setToastMessage('👁️ You are in Spectator Mode. Request a seat to play!');
          return;
        }
        if (gameState.turn !== myRole) return;
      }

      const [r, c] = pos;
      const clickedPiece = gameState.board[r][c];

      // If a piece is already selected, check if clicked square is a legal destination
      if (gameState.selectedPos) {
        const legalMove = gameState.legalMoves.find(
          (m) => m.to[0] === r && m.to[1] === c
        );

        if (legalMove) {
          // Check for pawn promotion: pawn reaching row 0 (White) or row 7 (Black)
          const isPromotionRank =
            legalMove.piece.type === 'p' &&
            ((legalMove.piece.color === 'w' && r === 0) ||
              (legalMove.piece.color === 'b' && r === 7));

          if (isPromotionRank && !legalMove.promotion) {
            setPendingPromotion({
              from: legalMove.from,
              to: [r, c],
              piece: legalMove.piece,
              captured: legalMove.captured,
            });
            return;
          }

          // Execute move
          setHistoryStack((prev) => [...prev, gameState]);
          const nextState = applyMove(gameState, legalMove);
          setGameState(nextState);
          setActiveHint(null);
          setHintExplanation(null);
          triggerMoveSound(legalMove, nextState.isCheck, nextState.isCheckmate);

          if (gameMode === 'online') {
            chessMultiplayer.sendMove(legalMove, nextState.turn);
          }
          return;
        }
      }

      // If user clicked on one of their own pieces, select it and compute legal moves
      if (clickedPiece && clickedPiece.color === gameState.turn) {
        if (gameMode === 'online' && myRole !== clickedPiece.color) {
          return; // Cannot select opponent's pieces
        }
        if (gameMode === 'ai' && myRole !== clickedPiece.color) {
          return; // Cannot select AI bot's pieces
        }

        const moves = getLegalMoves(
          pos,
          gameState.board,
          gameState.enPassantTarget,
          gameState.castlingRights
        );
        setGameState((prev) => ({
          ...prev,
          selectedPos: pos,
          legalMoves: moves,
        }));
      } else {
        // Deselect
        setGameState((prev) => ({
          ...prev,
          selectedPos: null,
          legalMoves: [],
        }));
        setActiveHint(null);
        setHintExplanation(null);
      }
    },
    [gameState, isAiThinking, gameMode, myRole, triggerMoveSound]
  );

  // Generate tactical AI hint
  const handleGetHint = useCallback(() => {
    if (isAiThinking || gameState.isCheckmate || gameState.isStalemate) return;
    const best = getBestMove(gameState, 'hard');
    if (!best) return;

    let explanation = 'Solid positional development.';
    if (best.isCastling) {
      explanation = 'Castle king to safety and connect your rooks.';
    } else if (best.captured) {
      const pName =
        best.captured.type === 'q'
          ? 'Queen'
          : best.captured.type === 'r'
          ? 'Rook'
          : best.captured.type === 'b'
          ? 'Bishop'
          : best.captured.type === 'n'
          ? 'Knight'
          : 'Pawn';
      explanation = `Capture opponent's ${pName} on ${best.san?.slice(-2) || 'target'}.`;
    } else if (best.san?.includes('+')) {
      explanation = 'Deliver check to force opponent response.';
    }

    setActiveHint(best);
    setHintExplanation(explanation);

    const moves = getLegalMoves(
      best.from,
      gameState.board,
      gameState.enPassantTarget,
      gameState.castlingRights
    );
    setGameState((prev) => ({
      ...prev,
      selectedPos: best.from,
      legalMoves: moves,
    }));
  }, [gameState, isAiThinking]);

  // Pawn Promotion Choice Selection
  const handleChoosePromotion = (promoType: PieceType) => {
    if (!pendingPromotion) return;
    const { from, to, piece, captured } = pendingPromotion;

    const promoMove: Move = {
      from,
      to,
      piece,
      captured,
      promotion: promoType,
      san: `${String.fromCharCode(97 + to[1])}${8 - to[0]}=${promoType.toUpperCase()}`,
    };

    setHistoryStack((prev) => [...prev, gameState]);
    const nextState = applyMove(gameState, promoMove);
    setGameState(nextState);
    setPendingPromotion(null);
    triggerMoveSound(promoMove, nextState.isCheck, nextState.isCheckmate);

    if (gameMode === 'online') {
      chessMultiplayer.sendMove(promoMove, nextState.turn);
    }
  };

  // Undo Move
  const handleUndo = () => {
    if (historyStack.length === 0 || isAiThinking) return;
    const targetSteps = gameMode === 'ai' ? 2 : 1;
    if (historyStack.length <= targetSteps) {
      const initial = historyStack[0];
      setGameState(initial);
      setHistoryStack([]);
    } else {
      const targetState = historyStack[historyStack.length - targetSteps];
      setGameState(targetState);
      setHistoryStack((prev) => prev.slice(0, prev.length - targetSteps));
    }
    setActiveHint(null);
    setHintExplanation(null);
    aiThinkingRef.current = false;
    setIsAiThinking(false);
  };

  // Restart / New Game
  const handleNewGame = () => {
    const fresh = createInitialGameState();
    setGameState(fresh);
    setHistoryStack([]);
    setActiveHint(null);
    setHintExplanation(null);
    aiThinkingRef.current = false;
    setIsAiThinking(false);
    if (gameMode === 'online') {
      chessMultiplayer.sendReset();
    }
  };

  // Copy Invite Link
  const handleCopyInviteLink = (code: string) => {
    const link = getInviteUrl(code);
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setToastMessage('📋 Invite link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // Send Email Invite
  const handleSendEmailInvite = async (recipientEmail: string, roomCode: string) => {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      setToastMessage('⚠️ Please enter a valid recipient email address.');
      return;
    }
    setIsSendingEmail(true);
    try {
      const inviteUrl = getInviteUrl(roomCode);
      const inviterName = currentUser?.name || currentUser?.username || 'Your friend';
      const res = await fetch('/api/v1/chess/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: recipientEmail,
          inviterName,
          inviteUrl,
          roomCode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage(`✉️ Challenge email successfully sent to ${recipientEmail}!`);
        setInviteEmailInput('');
      } else {
        setToastMessage(`⚠️ Note: ${data.reason || 'Simulated invite recorded in dev mode.'}`);
      }
    } catch {
      setToastMessage(`✉️ Challenge link ready and simulated for ${recipientEmail}!`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Accept Invite / Join Flow
  const handleAcceptJoin = (mode: 'play' | 'spectate') => {
    const targetRoom = pendingAcceptRoomId || onlineRoomId;

    if (mode === 'play') {
      // Must be logged in to play match!
      if (!currentUser) {
        setAuthPromptReason('You must log in to your account to play as an active participant in this match.');
        setAuthModalOpen(true);
        return;
      }

      // Check seat availability
      const isWhiteOccupied = !!roomPresence.whitePlayer;
      const isBlackOccupied = !!roomPresence.blackPlayer;

      if (isWhiteOccupied && isBlackOccupied) {
        setToastMessage('⚠️ Both player seats are occupied! You can spectate or request to play next.');
        return;
      }

      const assignedRole: PieceColor = isWhiteOccupied ? 'b' : 'w';
      startMultiplayerSession(targetRoom, assignedRole);
      setAcceptModalOpen(false);
      setToastMessage(`🎮 Joined match as ${assignedRole === 'w' ? 'White (Plays First)' : 'Black'}!`);
    } else {
      // Spectator mode
      startMultiplayerSession(targetRoom, 'spectator');
      setAcceptModalOpen(false);
      setToastMessage('👁️ Joined live match as Spectator.');
    }
  };

  // Request to play while in spectator mode
  const handleRequestSeat = () => {
    if (!currentUser) {
      setAuthPromptReason('Please log into your account to request a seat in this match.');
      setAuthModalOpen(true);
      return;
    }
    chessMultiplayer.requestSeat('any');
    setToastMessage('📨 Seat request sent to the players! When the match finishes, you will be queued.');
  };

  // Check if room is 2/2 full
  const isRoomFull = !!(roomPresence.whitePlayer && roomPresence.blackPlayer);

  return (
    <Box sx={{ width: '100%', py: { xs: 1, md: 3 }, px: { xs: 1, md: 2 } }}>
      {/* Top Header & Settings Controls */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
            ♟️ Nexus Chess
          </Typography>

          {gameMode === 'online' && (
            <Chip
              label={
                myRole === 'spectator'
                  ? '👁️ Spectator Mode'
                  : `⚔️ Playing as ${myRole === 'w' ? 'White' : 'Black'}`
              }
              color={myRole === 'spectator' ? 'info' : 'primary'}
              size="small"
              sx={{ fontWeight: 800, fontSize: '0.75rem' }}
            />
          )}

          {gameMode === 'online' && (
            <Chip
              label={`Room: ${onlineRoomId}`}
              variant="outlined"
              size="small"
              sx={{ fontWeight: 700, fontSize: '0.72rem' }}
            />
          )}
        </Box>

        {/* View Themes & Actions */}
        <Stack direction="row" spacing={1} alignItems="center">
          <ToggleButtonGroup
            value={uiTheme}
            exclusive
            onChange={(_, val) => val && setUiTheme(val)}
            size="small"
          >
            <ToggleButton value="3d-wood" sx={{ textTransform: 'none', fontWeight: 700, gap: 0.5, fontSize: '0.75rem' }}>
              <ViewInAr fontSize="small" /> 3D Classic
            </ToggleButton>
            <ToggleButton value="3d-neon" sx={{ textTransform: 'none', fontWeight: 700, gap: 0.5, fontSize: '0.75rem' }}>
              <AutoAwesome fontSize="small" /> 3D Neon
            </ToggleButton>
            <ToggleButton value="2d-classic" sx={{ textTransform: 'none', fontWeight: 700, gap: 0.5, fontSize: '0.75rem' }}>
              <GridOn fontSize="small" /> 2D Grid
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Box>

      {/* Main Chess Arena Layout */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        {/* Left Column: Chess Board & Player Stats */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* Top Captured Bar (Black pieces captured by White) */}
          <Paper
            elevation={0}
            sx={{
              px: 2,
              py: 1,
              borderRadius: '12px',
              bgcolor: isDark ? 'rgba(15, 23, 42, 0.4)' : 'rgba(241, 245, 249, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 44,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                {gameMode === 'ai'
                  ? myRole === 'w' ? '🤖 Bot (Black)' : '🤖 Bot (White)'
                  : gameMode === 'online'
                  ? `👤 ${roomPresence.blackPlayer?.name || 'Waiting for Black...'}`
                  : 'Black'}
              </Typography>
              {isAiThinking && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <CircularProgress size={12} color="secondary" />
                  <Typography variant="caption" sx={{ color: 'secondary.main', fontWeight: 600 }}>
                    thinking...
                  </Typography>
                </Box>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ display: 'flex', gap: 0.2, fontSize: '1.2rem', color: isDark ? '#F8FAFC' : '#1E293B' }}>
                {gameState.capturedWhite.map((p, i) => (
                  <span key={i}>{PIECE_SYMBOLS.w[p.type]}</span>
                ))}
              </Box>
              {materialAdvantage.blackLead > 0 && (
                <Chip label={`+${materialAdvantage.blackLead}`} size="small" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 800 }} />
              )}
            </Box>
          </Paper>

          {/* AI Hint Alert */}
          {hintExplanation && activeHint && (
            <Alert
              icon={<TipsAndUpdates sx={{ color: '#10B981' }} />}
              severity="success"
              onClose={() => {
                setActiveHint(null);
                setHintExplanation(null);
              }}
              sx={{
                borderRadius: '12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                bgcolor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                color: isDark ? '#A7F3D0' : '#065F46',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              💡 <strong>AI Hint ({activeHint.san}):</strong> {hintExplanation}
            </Alert>
          )}

          {/* Spectator Live Mode Banner */}
          {gameMode === 'online' && myRole === 'spectator' && (
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: '12px',
                bgcolor: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <VisibilityOutlined sx={{ color: '#38BDF8' }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#38BDF8', fontSize: '0.82rem' }}>
                    Spectator Mode (Live Match View)
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Watching moves in real time. Board interaction is disabled.
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<SportsEsportsOutlined />}
                onClick={handleRequestSeat}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  borderRadius: '8px',
                  borderColor: '#38BDF8',
                  color: '#38BDF8',
                  '&:hover': { borderColor: '#0284C7', bgcolor: 'rgba(56, 189, 248, 0.08)' },
                }}
              >
                Request to Play Next
              </Button>
            </Paper>
          )}

          {/* Interactive Chess Board View (3D or 2D) */}
          {uiTheme === '2d-classic' ? (
            <Chess2DView
              board={gameState.board}
              turn={gameState.turn}
              selectedPos={gameState.selectedPos}
              legalMoves={gameState.legalMoves}
              lastMove={lastMove}
              activeHint={activeHint}
              isCheck={gameState.isCheck}
              isFlipped={isFlipped}
              onSelectSquare={handleSelectSquare}
            />
          ) : (
            <Chess3DView
              board={gameState.board}
              turn={gameState.turn}
              selectedPos={gameState.selectedPos}
              legalMoves={gameState.legalMoves}
              lastMove={lastMove}
              activeHint={activeHint}
              isCheck={gameState.isCheck}
              isFlipped={isFlipped}
              themeMode={uiTheme}
              onSelectSquare={handleSelectSquare}
            />
          )}

          {/* Bottom Captured Bar (White pieces captured by Black) */}
          <Paper
            elevation={0}
            sx={{
              px: 2,
              py: 1,
              borderRadius: '12px',
              bgcolor: isDark ? 'rgba(15, 23, 42, 0.4)' : 'rgba(241, 245, 249, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 44,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              {gameMode === 'online'
                ? `👤 ${roomPresence.whitePlayer?.name || 'Waiting for White...'}`
                : gameMode === 'ai'
                ? myRole === 'w' ? '👤 You (White)' : '👤 You (Black)'
                : '👤 You (White)'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ display: 'flex', gap: 0.2, fontSize: '1.2rem', color: isDark ? '#94A3B8' : '#0F172A' }}>
                {gameState.capturedBlack.map((p, i) => (
                  <span key={i}>{PIECE_SYMBOLS.b[p.type]}</span>
                ))}
              </Box>
              {materialAdvantage.whiteLead > 0 && (
                <Chip label={`+${materialAdvantage.whiteLead}`} size="small" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 800 }} />
              )}
            </Box>
          </Paper>
        </Box>

        {/* Right Column: Game Controls, Match Status & Lobby */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Match Status Banner */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: '16px',
              bgcolor: gameState.isCheckmate
                ? 'rgba(239, 68, 68, 0.15)'
                : gameState.isCheck
                ? 'rgba(245, 158, 11, 0.15)'
                : isDark
                ? 'rgba(30, 41, 59, 0.5)'
                : '#FFFFFF',
              border: `1px solid ${
                gameState.isCheckmate
                  ? '#EF4444'
                  : gameState.isCheck
                  ? '#F59E0B'
                  : isDark
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(0, 0, 0, 0.08)'
              }`,
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Match Status
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.5 }}>
              {gameState.isCheckmate
                ? `🏆 Checkmate! ${gameState.winner === 'w' ? 'White' : 'Black'} Wins!`
                : gameState.isStalemate
                ? '🤝 Draw by Stalemate'
                : isAiThinking
                ? '🤖 Bot is thinking of a move...'
                : gameState.isCheck
                ? `⚠️ Check! (${gameState.turn === 'w' ? 'White' : 'Black'} to move)`
                : `${gameState.turn === 'w' ? 'White' : 'Black'} to move`}
            </Typography>
          </Paper>

          {/* Game Options & Lobby Controls */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: '16px',
              bgcolor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#FFFFFF',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
              Game Mode
            </Typography>

            {/* Mode Select (vs Bot / Local 2P / Online) */}
            <ToggleButtonGroup
              value={gameMode}
              exclusive
              onChange={(_, v) => {
                if (!v) return;
                setGameMode(v);
                if (v === 'online') {
                  setCreateModalOpen(true);
                }
              }}
              fullWidth
              size="small"
            >
              <ToggleButton value="ai" sx={{ textTransform: 'none', fontWeight: 700, gap: 0.6, fontSize: '0.78rem' }}>
                <SmartToyOutlined fontSize="small" /> vs AI
              </ToggleButton>
              <ToggleButton value="local" sx={{ textTransform: 'none', fontWeight: 700, gap: 0.6, fontSize: '0.78rem' }}>
                <PersonOutline fontSize="small" /> Pass & Play
              </ToggleButton>
              <ToggleButton value="online" sx={{ textTransform: 'none', fontWeight: 700, gap: 0.6, fontSize: '0.78rem' }}>
                <PublicOutlined fontSize="small" /> 🌐 Online
              </ToggleButton>
            </ToggleButtonGroup>

            {/* Dedicated Create Room & Join Room Action Bar */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddCircleOutline />}
                onClick={() => {
                  setCustomRoomCode(generateRoomCode());
                  setCreateModalOpen(true);
                }}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                }}
              >
                Create Room
              </Button>

              <Button
                variant="outlined"
                size="small"
                startIcon={<MeetingRoomOutlined />}
                onClick={() => setJoinModalOpen(true)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  borderRadius: '8px',
                }}
              >
                Join Room
              </Button>
            </Box>

            {/* Active Online Room Card */}
            {gameMode === 'online' && (
              <Box
                sx={{
                  p: 1.8,
                  borderRadius: '12px',
                  bgcolor: isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '0.85rem' }}>
                    Active Room: {onlineRoomId}
                  </Typography>
                  <Chip
                    label={isRoomFull ? '🟢 2/2 Players' : '⏳ Waiting Seat'}
                    size="small"
                    color={isRoomFull ? 'success' : 'warning'}
                    sx={{ fontWeight: 700, fontSize: '0.68rem', height: 22 }}
                  />
                </Box>

                {/* Participant Roster */}
                <Box sx={{ fontSize: '0.75rem', color: 'text.secondary', display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>⚪ White:</span>
                    <strong>{roomPresence.whitePlayer?.name || 'Empty (Available)'}</strong>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>⚫ Black:</span>
                    <strong>{roomPresence.blackPlayer?.name || 'Empty (Available)'}</strong>
                  </Box>
                  {roomPresence.spectators.length > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', color: '#38BDF8' }}>
                      <span>👁️ Spectators:</span>
                      <strong>{roomPresence.spectators.length} watching</strong>
                    </Box>
                  )}
                </Box>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    size="small"
                    fullWidth
                    startIcon={copiedLink ? <Check /> : <ContentCopy />}
                    onClick={() => handleCopyInviteLink(onlineRoomId)}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      borderRadius: '8px',
                      background: copiedLink ? '#10B981' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                    }}
                  >
                    {copiedLink ? 'Link Copied!' : 'Copy Game Link'}
                  </Button>
                </Stack>
              </Box>
            )}

            {/* AI Side & Difficulty Selectors */}
            {gameMode === 'ai' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block', fontWeight: 700 }}>
                    Your Side:
                  </Typography>
                  <ToggleButtonGroup
                    value={myRole}
                    exclusive
                    onChange={(_, role: ChessPlayerRole | null) => {
                      if (!role || role === 'spectator') return;
                      setMyRole(role);
                      setIsFlipped(role === 'b');
                      const fresh = createInitialGameState();
                      setGameState(fresh);
                      setHistoryStack([]);
                      setActiveHint(null);
                      setHintExplanation(null);
                      aiThinkingRef.current = false;
                      setIsAiThinking(false);
                    }}
                    fullWidth
                    size="small"
                  >
                    <ToggleButton value="w" sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.4, fontWeight: 700 }}>
                      ⚪ White (First)
                    </ToggleButton>
                    <ToggleButton value="b" sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.4, fontWeight: 700 }}>
                      ⚫ Black
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block', fontWeight: 700 }}>
                    Bot Difficulty:
                  </Typography>
                <ToggleButtonGroup
                  value={difficulty}
                  exclusive
                  onChange={(_, v) => v && setDifficulty(v)}
                  fullWidth
                  size="small"
                >
                  <ToggleButton value="easy" sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.4 }}>
                    Novice
                  </ToggleButton>
                  <ToggleButton value="medium" sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.4 }}>
                    Intermediate
                  </ToggleButton>
                  <ToggleButton value="hard" sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.4 }}>
                    Master
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Box>
          )}

            {/* Action Buttons: Undo, Hint, Flip, Sound */}
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Undo />}
                onClick={handleUndo}
                disabled={historyStack.length === 0 || isAiThinking || gameMode === 'online'}
                sx={{ flex: 1, textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
              >
                Undo
              </Button>

              <Button
                variant="outlined"
                size="small"
                startIcon={<LightbulbOutlined sx={{ color: '#10B981' }} />}
                onClick={handleGetHint}
                disabled={isAiThinking || gameState.isCheckmate || gameState.isStalemate || (gameMode === 'online' && myRole === 'spectator')}
                sx={{
                  flex: 1,
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: '8px',
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                  color: '#10B981',
                  '&:hover': {
                    borderColor: '#10B981',
                    bgcolor: 'rgba(16, 185, 129, 0.08)',
                  },
                }}
              >
                Hint
              </Button>

              <Tooltip title="Flip Board Perspective">
                <IconButton
                  size="small"
                  onClick={() => setIsFlipped((prev) => !prev)}
                  sx={{ border: `1px solid ${isDark ? '#334155' : '#CBD5E1'}`, borderRadius: '8px' }}
                >
                  <SwapVert fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title={soundEnabled ? 'Mute Sound Effects' : 'Enable Sound Effects'}>
                <IconButton
                  size="small"
                  onClick={() => setSoundEnabled((s) => !s)}
                  sx={{ border: `1px solid ${isDark ? '#334155' : '#CBD5E1'}`, borderRadius: '8px' }}
                >
                  {soundEnabled ? <VolumeUp fontSize="small" /> : <VolumeOff fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Stack>

            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<PlayArrow />}
              onClick={handleNewGame}
              sx={{
                borderRadius: '8px',
                py: 0.8,
                textTransform: 'none',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              }}
            >
              New Game
            </Button>
          </Paper>

          {/* Move History Table */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: '16px',
              bgcolor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#FFFFFF',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 280,
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', mb: 1 }}>
              Move Notation History
            </Typography>

            <Box sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
              {gameState.moveHistory.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', textAlign: 'center', py: 3 }}>
                  No moves played yet
                </Typography>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr', rowGap: 0.5, fontSize: '0.82rem' }}>
                  {Array.from({ length: Math.ceil(gameState.moveHistory.length / 2) }).map((_, moveIdx) => {
                    const whiteMove = gameState.moveHistory[moveIdx * 2];
                    const blackMove = gameState.moveHistory[moveIdx * 2 + 1];

                    return (
                      <React.Fragment key={moveIdx}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          {moveIdx + 1}.
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                          {whiteMove?.san || ''}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                          {blackMove?.san || ''}
                        </Typography>
                      </React.Fragment>
                    );
                  })}
                </Box>
              )}
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* CREATE ROOM MODAL */}
      <Dialog
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            bgcolor: isDark ? '#0F172A' : '#FFFFFF',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>♟️ Create Chess Match</span>
          <IconButton size="small" onClick={() => setCreateModalOpen(false)}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Room Code
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={customRoomCode}
              onChange={(e) => setCustomRoomCode(e.target.value.toUpperCase())}
              placeholder="e.g. NX-4829"
              inputProps={{ style: { fontFamily: 'monospace', fontWeight: 700, letterSpacing: '2px' } }}
            />
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Your Side
            </Typography>
            <ToggleButtonGroup
              value={selectedSide}
              exclusive
              onChange={(_, v) => v && setSelectedSide(v)}
              fullWidth
              size="small"
            >
              <ToggleButton value="w" sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.78rem' }}>
                ⚪ White (First)
              </ToggleButton>
              <ToggleButton value="b" sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.78rem' }}>
                ⚫ Black
              </ToggleButton>
              <ToggleButton value="random" sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.78rem' }}>
                🎲 Random
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Divider sx={{ my: 0.5 }} />

          {/* Share Link */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Invite Link
            </Typography>
            <Button
              variant="outlined"
              fullWidth
              size="small"
              startIcon={<LinkOutlined />}
              onClick={() => handleCopyInviteLink(customRoomCode)}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px', py: 0.8 }}
            >
              {copiedLink ? 'Link Copied!' : 'Copy Shareable Match Link'}
            </Button>
          </Box>

          {/* Send Challenge via Email */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Challenge Player via Email
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="friend@example.com"
                value={inviteEmailInput}
                onChange={(e) => setInviteEmailInput(e.target.value)}
              />
              <Button
                variant="contained"
                size="small"
                disabled={isSendingEmail || !inviteEmailInput}
                onClick={() => handleSendEmailInvite(inviteEmailInput, customRoomCode)}
                sx={{
                  borderRadius: '8px',
                  minWidth: 44,
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                }}
              >
                {isSendingEmail ? <CircularProgress size={16} color="inherit" /> : <SendOutlined fontSize="small" />}
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="contained"
            fullWidth
            onClick={() => {
              const assignedRole: PieceColor =
                selectedSide === 'random' ? (Math.random() > 0.5 ? 'w' : 'b') : selectedSide;
              startMultiplayerSession(customRoomCode, assignedRole);
              setCreateModalOpen(false);
              setToastMessage(`🎮 Created Room ${customRoomCode}! You are playing as ${assignedRole === 'w' ? 'White' : 'Black'}.`);
            }}
            sx={{
              py: 1,
              borderRadius: '10px',
              fontWeight: 800,
              textTransform: 'none',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            }}
          >
            Create & Enter Arena
          </Button>
        </DialogActions>
      </Dialog>

      {/* JOIN ROOM MODAL */}
      <Dialog
        open={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            bgcolor: isDark ? '#0F172A' : '#FFFFFF',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>🚪 Join Chess Match</span>
          <IconButton size="small" onClick={() => setJoinModalOpen(false)}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Enter a 6-character room code or paste an invitation link to connect:
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="e.g. NX-4829 or paste full URL"
            value={joinInputCode}
            onChange={(e) => {
              const val = e.target.value.trim();
              if (val.includes('chess-room=')) {
                const match = val.match(/chess-room=([a-zA-Z0-9_-]+)/);
                if (match) setJoinInputCode(match[1]);
              } else if (val.includes('room=')) {
                const match = val.match(/room=([a-zA-Z0-9_-]+)/);
                if (match) setJoinInputCode(match[1]);
              } else {
                setJoinInputCode(val.toUpperCase());
              }
            }}
            inputProps={{ style: { fontFamily: 'monospace', fontWeight: 700 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="contained"
            fullWidth
            disabled={!joinInputCode}
            onClick={() => {
              setPendingAcceptRoomId(joinInputCode);
              setJoinModalOpen(false);
              setAcceptModalOpen(true);
            }}
            sx={{
              py: 1,
              borderRadius: '10px',
              fontWeight: 800,
              textTransform: 'none',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            }}
          >
            Connect to Match
          </Button>
        </DialogActions>
      </Dialog>

      {/* ACCEPT INVITE / CHOOSE ROLE MODAL (Play Match vs View Match) */}
      <Dialog
        open={acceptModalOpen}
        onClose={() => setAcceptModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '24px',
            bgcolor: isDark ? '#0F172A' : '#FFFFFF',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)'}`,
            p: 1.5,
          },
        }}
      >
        <DialogTitle sx={{ textAlign: 'center', pb: 0.5 }}>
          <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.02em' }}>
            ♟️ Match Invitation
          </Typography>
          <Chip
            label={`Room: ${pendingAcceptRoomId || onlineRoomId}`}
            size="small"
            sx={{ mt: 1, fontWeight: 800, fontFamily: 'monospace', fontSize: '0.8rem' }}
          />
        </DialogTitle>

        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
          {/* Current Room Capacity Status */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: '14px',
              bgcolor: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(241, 245, 249, 0.8)',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
              Current Match Seating
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, fontSize: '0.85rem' }}>
              <span>⚪ White: <strong>{roomPresence.whitePlayer?.name || 'Open Seat'}</strong></span>
              <span>⚫ Black: <strong>{roomPresence.blackPlayer?.name || 'Open Seat'}</strong></span>
            </Box>
          </Paper>

          {/* Option Cards: Play Match vs View Match */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {/* Card 1: Play Match */}
            <Card
              variant="outlined"
              sx={{
                borderRadius: '16px',
                borderColor: isRoomFull ? 'rgba(239, 68, 68, 0.4)' : 'rgba(99, 102, 241, 0.4)',
                bgcolor: isRoomFull
                  ? isDark ? 'rgba(239, 68, 68, 0.05)' : 'rgba(239, 68, 68, 0.03)'
                  : isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)',
                opacity: isRoomFull ? 0.75 : 1,
                position: 'relative',
              }}
            >
              <CardActionArea
                disabled={isRoomFull}
                onClick={() => handleAcceptJoin('play')}
                sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between' }}
              >
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <SportsEsportsOutlined sx={{ color: isRoomFull ? '#EF4444' : '#6366F1', fontSize: '1.8rem' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      Play Match
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem', mb: 1.5 }}>
                    Compete live as White or Black. You must be signed in to your account.
                  </Typography>
                </Box>

                {isRoomFull ? (
                  <Chip
                    label="Both players present (2/2)"
                    color="error"
                    size="small"
                    sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                  />
                ) : (
                  <Chip
                    label="Seat Available"
                    color="primary"
                    size="small"
                    sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                  />
                )}
              </CardActionArea>
            </Card>

            {/* Card 2: View Match (Spectator) */}
            <Card
              variant="outlined"
              sx={{
                borderRadius: '16px',
                borderColor: 'rgba(56, 189, 248, 0.4)',
                bgcolor: isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(56, 189, 248, 0.04)',
              }}
            >
              <CardActionArea
                onClick={() => handleAcceptJoin('spectate')}
                sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between' }}
              >
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <VisibilityOutlined sx={{ color: '#38BDF8', fontSize: '1.8rem' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      View Match
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem', mb: 1.5 }}>
                    Watch the game live in real time as a spectator. No moves allowed.
                  </Typography>
                </Box>

                <Chip
                  label="Free to Watch"
                  color="info"
                  size="small"
                  sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                />
              </CardActionArea>
            </Card>
          </Box>

          {/* When room is full: Request to Play button */}
          {isRoomFull && (
            <Alert
              severity="warning"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    handleAcceptJoin('spectate');
                    handleRequestSeat();
                  }}
                  sx={{ fontWeight: 800, textTransform: 'none' }}
                >
                  Request to Play Next
                </Button>
              }
              sx={{ borderRadius: '12px', fontSize: '0.82rem' }}
            >
              Both player seats are currently filled. You can watch as a spectator or request to challenge the winner!
            </Alert>
          )}

          {/* Login prompt reminder if not logged in */}
          {!currentUser && (
            <Box
              sx={{
                p: 1.5,
                borderRadius: '12px',
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <LockOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }}>
                Note: To join as an active competitor, you need to sign in to your Nexus Notes account. Spectators can watch without signing in.
              </Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Pawn Promotion Modal */}
      <Dialog open={!!pendingPromotion} onClose={() => {}}>
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 800 }}>Promote Pawn</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ textAlign: 'center', mb: 2, color: 'text.secondary' }}>
            Choose which piece to promote your pawn to:
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center">
            {(['q', 'r', 'b', 'n'] as PieceType[]).map((type) => (
              <Button
                key={type}
                variant="outlined"
                onClick={() => handleChoosePromotion(type)}
                sx={{
                  width: 64,
                  height: 64,
                  fontSize: '2rem',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {pendingPromotion ? PIECE_SYMBOLS[pendingPromotion.piece.color][type] : ''}
              </Button>
            ))}
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Auth Modal for Login Requirement */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* Notification Toast */}
      <Snackbar
        open={!!toastMessage}
        autoHideDuration={4000}
        onClose={() => setToastMessage(null)}
        message={toastMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};
