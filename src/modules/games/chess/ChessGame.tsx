import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Stack,
  CircularProgress,
  Alert,
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

export const ChessGame: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

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
  const [activeHint, setActiveHint] = useState<Move | null>(null);
  const [hintExplanation, setHintExplanation] = useState<string | null>(null);

  // Promotion Picker State
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Position;
    to: Position;
    piece: Piece;
    captured?: Piece | null;
  } | null>(null);

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

  // Trigger Sound
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

  // Online Multiplayer State
  const [onlineRoomId, setOnlineRoomId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const match = hash.match(/chess-room=([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
    }
    return `room_${Math.random().toString(36).substring(2, 8)}`;
  });

  const [myOnlineColor, setMyOnlineColor] = useState<PieceColor>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash.includes('color=b')) return 'b';
    }
    return 'w';
  });

  const [peerConnected, setPeerConnected] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Auto-detect multiplayer link on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('chess-room')) {
      setGameMode('online');
      if (window.location.hash.includes('color=b')) {
        setMyOnlineColor('b');
        setIsFlipped(true);
      }
    }
  }, []);

  // Sync multiplayer socket & BroadcastChannel
  useEffect(() => {
    if (gameMode !== 'online') {
      chessMultiplayer.disconnect();
      return;
    }

    chessMultiplayer.init(onlineRoomId, myOnlineColor);

    const unsubscribe = chessMultiplayer.subscribe((msg) => {
      if (msg.type === 'chess_move') {
        setHistoryStack((prev) => [...prev, gameState]);
        const nextState = applyMove(gameState, msg.move);
        setGameState(nextState);
        triggerMoveSound(msg.move, nextState.isCheck, nextState.isCheckmate);
      } else if (msg.type === 'chess_join') {
        setPeerConnected(true);
        chessMultiplayer.send({
          type: 'chess_peer_joined',
          roomId: onlineRoomId,
          color: myOnlineColor,
          playerId: chessMultiplayer.getPlayerId(),
        });
      } else if (msg.type === 'chess_peer_joined') {
        setPeerConnected(true);
      } else if (msg.type === 'chess_reset') {
        setGameState(createInitialGameState());
        setHistoryStack([]);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [gameMode, onlineRoomId, myOnlineColor, gameState, triggerMoveSound]);

  // Handle Square Selection and Piece Movement
  const handleSelectSquare = useCallback(
    (pos: Position) => {
      if (isAiThinking || gameState.isCheckmate || gameState.isStalemate) return;
      if (gameMode === 'online' && gameState.turn !== myOnlineColor) return;

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
    [gameState, isAiThinking, gameMode, myOnlineColor, triggerMoveSound]
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

    const move: Move = {
      from: pendingPromotion.from,
      to: pendingPromotion.to,
      piece: pendingPromotion.piece,
      captured: pendingPromotion.captured,
      promotion: promoType,
    };

    setHistoryStack((prev) => [...prev, gameState]);
    const nextState = applyMove(gameState, move);
    setGameState(nextState);
    triggerMoveSound(move, nextState.isCheck, nextState.isCheckmate);
    setPendingPromotion(null);

    if (gameMode === 'online') {
      chessMultiplayer.sendMove(move, nextState.turn);
    }
  };

  // AI Turn Execution
  useEffect(() => {
    if (
      gameMode === 'ai' &&
      gameState.turn === 'b' &&
      !gameState.isCheckmate &&
      !gameState.isStalemate
    ) {
      setIsAiThinking(true);

      const timer = setTimeout(() => {
        const aiMove = getBestMove(gameState, difficulty);
        if (aiMove) {
          setHistoryStack((prev) => [...prev, gameState]);
          const nextState = applyMove(gameState, aiMove);
          setGameState(nextState);
          triggerMoveSound(aiMove, nextState.isCheck, nextState.isCheckmate);
        }
        setIsAiThinking(false);
      }, 450);

      return () => clearTimeout(timer);
    }
  }, [gameState, gameMode, difficulty, triggerMoveSound]);

  // Undo Move Handler
  const handleUndo = () => {
    if (historyStack.length === 0 || isAiThinking) return;

    if (gameMode === 'ai') {
      // In AI mode, undo 2 plies back (player and AI)
      if (historyStack.length >= 2) {
        const target = historyStack[historyStack.length - 2];
        setGameState(target);
        setHistoryStack((prev) => prev.slice(0, prev.length - 2));
      } else {
        setGameState(historyStack[0]);
        setHistoryStack([]);
      }
    } else {
      const prev = historyStack[historyStack.length - 1];
      setGameState(prev);
      setHistoryStack((s) => s.slice(0, s.length - 1));
    }
  };

  // Reset Game
  const handleNewGame = () => {
    setGameState(createInitialGameState());
    setHistoryStack([]);
    setPendingPromotion(null);
    setActiveHint(null);
    setHintExplanation(null);
    if (gameMode === 'online') {
      chessMultiplayer.sendReset();
    }
  };

  const handleCopyInviteLink = () => {
    if (typeof window === 'undefined') return;
    const opponentColor = myOnlineColor === 'w' ? 'b' : 'w';
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const url = `${origin}${pathname}#chess-room=${onlineRoomId}&color=${opponentColor}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCreateNewRoom = () => {
    const newRoom = `room_${Math.random().toString(36).substring(2, 8)}`;
    setOnlineRoomId(newRoom);
    setMyOnlineColor('w');
    setIsFlipped(false);
    setPeerConnected(false);
    setGameState(createInitialGameState());
    setHistoryStack([]);
    if (typeof window !== 'undefined') {
      window.location.hash = `#chess-room=${newRoom}&color=w`;
    }
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 1, sm: 2, md: 3 } }}>
      {/* Top Header & 3-UI Theme Switcher */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: '16px',
          bgcolor: isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
            ♟️ Nexus Chess
          </Typography>
          <Chip
            label={uiTheme === '3d-wood' ? '3D Realistic' : uiTheme === '3d-neon' ? '3D Neon Sci-Fi' : '2D Classic'}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 600, fontSize: '0.75rem' }}
          />
        </Box>

        {/* 3 UI Experiences Switcher */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: { xs: 'none', sm: 'block' } }}>
            Board View:
          </Typography>
          <ToggleButtonGroup
            value={uiTheme}
            exclusive
            onChange={(_, val) => val && setUiTheme(val)}
            size="small"
            sx={{
              bgcolor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#F1F5F9',
              borderRadius: '10px',
              p: 0.3,
            }}
          >
            <ToggleButton value="3d-wood" sx={{ textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.75rem', fontWeight: 700, gap: 0.6 }}>
              <ViewInAr sx={{ fontSize: 16 }} /> 3D Board
            </ToggleButton>
            <ToggleButton value="2d-classic" sx={{ textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.75rem', fontWeight: 700, gap: 0.6 }}>
              <GridOn sx={{ fontSize: 16 }} /> 2D Classic
            </ToggleButton>
            <ToggleButton value="3d-neon" sx={{ textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.75rem', fontWeight: 700, gap: 0.6 }}>
              <AutoAwesome sx={{ fontSize: 16 }} /> 3D Neon
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Paper>

      {/* Main Chess Arena Grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 340px' }, gap: 3 }}>
        {/* Left Column: Board & Captured Pieces */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                {gameMode === 'ai' ? '🤖 Bot (Black)' : 'Black'}
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

          {/* AI Hint Explanation Alert */}
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

          {/* Interactive Board View (3D or 2D) */}
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
              👤 You (White)
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

        {/* Right Column: Game Controls, Match Status & Move History */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Status Banner */}
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
              Status
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.5 }}>
              {gameState.isCheckmate
                ? `🏆 Checkmate! ${gameState.winner === 'w' ? 'White' : 'Black'} Wins!`
                : gameState.isStalemate
                ? '🤝 Draw by Stalemate'
                : gameState.isCheck
                ? `⚠️ Check! (${gameState.turn === 'w' ? 'White' : 'Black'} to move)`
                : `${gameState.turn === 'w' ? 'White' : 'Black'} to move`}
            </Typography>
          </Paper>

          {/* Controls & Match Setup */}
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
              Game Options
            </Typography>

            {/* Mode Select (vs Bot / Local 2P / Online) */}
            <ToggleButtonGroup
              value={gameMode}
              exclusive
              onChange={(_, v) => {
                if (!v) return;
                setGameMode(v);
                if (v === 'online' && typeof window !== 'undefined' && !window.location.hash.includes('chess-room')) {
                  window.location.hash = `#chess-room=${onlineRoomId}&color=w`;
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

            {/* Online Multiplayer Lobby / Room Info */}
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
                    Multiplayer Room
                  </Typography>
                  <Chip
                    label={peerConnected ? '🟢 Opponent Connected' : '⏳ Waiting for Opponent'}
                    size="small"
                    color={peerConnected ? 'success' : 'warning'}
                    sx={{ fontWeight: 700, fontSize: '0.68rem', height: 22 }}
                  />
                </Box>

                <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.4 }}>
                  You are playing as <strong>{myOnlineColor === 'w' ? 'White (First Move)' : 'Black'}</strong>.
                  {gameState.turn !== myOnlineColor
                    ? ' Waiting for opponent to make a move...'
                    : ' Your turn to move!'}
                </Typography>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    size="small"
                    fullWidth
                    startIcon={copiedLink ? <Check /> : <ContentCopy />}
                    onClick={handleCopyInviteLink}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      borderRadius: '8px',
                      background: copiedLink ? '#10B981' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                    }}
                  >
                    {copiedLink ? 'Link Copied!' : 'Copy Game Link'}
                  </Button>

                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleCreateNewRoom}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      borderRadius: '8px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    New Room
                  </Button>
                </Stack>
              </Box>
            )}

            {/* AI Difficulty Selector */}
            {gameMode === 'ai' && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
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
            )}

            {/* Action Buttons: Undo, Hint, Flip, Sound, New Game */}
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Undo />}
                onClick={handleUndo}
                disabled={historyStack.length === 0 || isAiThinking}
                sx={{ flex: 1, textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
              >
                Undo
              </Button>

              <Button
                variant="outlined"
                size="small"
                startIcon={<LightbulbOutlined sx={{ color: '#10B981' }} />}
                onClick={handleGetHint}
                disabled={isAiThinking || gameState.isCheckmate || gameState.isStalemate}
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
    </Box>
  );
};
