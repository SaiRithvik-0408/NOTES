import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  useTheme,
} from '@mui/material';
import { Undo, Refresh, EmojiEvents, VolumeUp, VolumeOff } from '@mui/icons-material';
import {
  Grid2048,
  Direction2048,
  initGame2048,
  makeMove2048,
} from './game2048Engine';

// Tile Palette configuration
const TILE_STYLES: Record<number, { bg: string; color: string; shadow?: string }> = {
  2: { bg: 'linear-gradient(135deg, #E2E8F0, #CBD5E1)', color: '#1E293B' },
  4: { bg: 'linear-gradient(135deg, #FEF08A, #FDE047)', color: '#713F12' },
  8: { bg: 'linear-gradient(135deg, #FED7AA, #FB923C)', color: '#FFFFFF', shadow: '0 4px 12px rgba(251, 146, 60, 0.4)' },
  16: { bg: 'linear-gradient(135deg, #FDBA74, #EA580C)', color: '#FFFFFF', shadow: '0 4px 12px rgba(234, 88, 12, 0.4)' },
  32: { bg: 'linear-gradient(135deg, #F87171, #EF4444)', color: '#FFFFFF', shadow: '0 4px 14px rgba(239, 68, 68, 0.45)' },
  64: { bg: 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#FFFFFF', shadow: '0 4px 16px rgba(220, 38, 38, 0.5)' },
  128: { bg: 'linear-gradient(135deg, #FDE047, #EAB308)', color: '#FFFFFF', shadow: '0 0 18px rgba(234, 179, 8, 0.55)' },
  256: { bg: 'linear-gradient(135deg, #FACC15, #CA8A04)', color: '#FFFFFF', shadow: '0 0 20px rgba(202, 138, 4, 0.6)' },
  512: { bg: 'linear-gradient(135deg, #818CF8, #6366F1)', color: '#FFFFFF', shadow: '0 0 22px rgba(99, 102, 241, 0.65)' },
  1024: { bg: 'linear-gradient(135deg, #C084FC, #9333EA)', color: '#FFFFFF', shadow: '0 0 24px rgba(147, 51, 234, 0.7)' },
  2048: { bg: 'linear-gradient(135deg, #F43F5E, #BE123C)', color: '#FFFFFF', shadow: '0 0 30px rgba(244, 63, 94, 0.8)' },
  4096: { bg: 'linear-gradient(135deg, #06B6D4, #0891B2)', color: '#FFFFFF', shadow: '0 0 32px rgba(6, 182, 212, 0.85)' },
};

export const Game2048View: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [grid, setGrid] = useState<Grid2048>(() => initGame2048());
  const [score, setScore] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('nexus_2048_highscore');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [history, setHistory] = useState<{ grid: Grid2048; score: number }[]>([]);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [won, setWon] = useState<boolean>(false);
  const [acknowledgedWin, setAcknowledgedWin] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Audio synthesizer for 2048
  const playTileSound = useCallback((type: 'slide' | 'merge') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'merge') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(640, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.11);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.06);
      }
    } catch {
      // AudioContext unavailable
    }
  }, [soundEnabled]);

  // Execute directional move
  const handleMove = useCallback(
    (dir: Direction2048) => {
      if (gameOver) return;

      const result = makeMove2048(grid, dir);
      if (result.moved) {
        setHistory((prev) => [...prev, { grid, score }]);
        setGrid(result.grid);

        const newScore = score + result.scoreGained;
        setScore(newScore);

        if (newScore > bestScore) {
          setBestScore(newScore);
          localStorage.setItem('nexus_2048_highscore', newScore.toString());
        }

        playTileSound(result.scoreGained > 0 ? 'merge' : 'slide');

        if (result.hasWon && !acknowledgedWin) {
          setWon(true);
        }

        if (result.isGameOver) {
          setGameOver(true);
        }
      }
    },
    [grid, score, bestScore, gameOver, acknowledgedWin, playTileSound]
  );

  // Keyboard navigation listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only capture arrow keys or WASD if target is not an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          handleMove('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          handleMove('down');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          handleMove('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          handleMove('right');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMove]);

  // Touch Swipe Gesture Handling
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) > 30) {
      if (absX > absY) {
        handleMove(dx > 0 ? 'right' : 'left');
      } else {
        handleMove(dy > 0 ? 'down' : 'up');
      }
    }
  };

  // Undo Move
  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setGrid(last.grid);
    setScore(last.score);
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setGameOver(false);
  };

  // Restart Game
  const handleRestart = () => {
    setGrid(initGame2048());
    setScore(0);
    setHistory([]);
    setGameOver(false);
    setWon(false);
    setAcknowledgedWin(false);
  };

  return (
    <Box
      sx={{
        maxWidth: 500,
        mx: 'auto',
        p: { xs: 1.5, sm: 2.5 },
        userSelect: 'none',
      }}
    >
      {/* Top Score & Action Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2.5,
          borderRadius: '16px',
          bgcolor: isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
            🧩 2048
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Join the numbers to reach 2048!
          </Typography>
        </Box>

        {/* Score Badges */}
        <Stack direction="row" spacing={1.5}>
          <Box
            sx={{
              px: 1.8,
              py: 0.8,
              borderRadius: '10px',
              bgcolor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#F1F5F9',
              textAlign: 'center',
              minWidth: 70,
            }}
          >
            <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'text.secondary' }}>
              Score
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              {score}
            </Typography>
          </Box>

          <Box
            sx={{
              px: 1.8,
              py: 0.8,
              borderRadius: '10px',
              bgcolor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#F1F5F9',
              textAlign: 'center',
              minWidth: 70,
            }}
          >
            <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'text.secondary', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.3 }}>
              <EmojiEvents sx={{ fontSize: 12, color: '#F59E0B' }} /> Best
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              {bestScore}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Action Toolbar */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          Swipe or use Arrow / WASD keys
        </Typography>

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Undo />}
            onClick={handleUndo}
            disabled={history.length === 0}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px', fontSize: '0.75rem' }}
          >
            Undo
          </Button>

          <IconButton
            size="small"
            onClick={handleRestart}
            sx={{ border: `1px solid ${isDark ? '#334155' : '#CBD5E1'}`, borderRadius: '8px' }}
          >
            <Refresh fontSize="small" />
          </IconButton>

          <IconButton
            size="small"
            onClick={() => setSoundEnabled((s) => !s)}
            sx={{ border: `1px solid ${isDark ? '#334155' : '#CBD5E1'}`, borderRadius: '8px' }}
          >
            {soundEnabled ? <VolumeUp fontSize="small" /> : <VolumeOff fontSize="small" />}
          </IconButton>
        </Stack>
      </Box>

      {/* 4x4 Game Board */}
      <Box
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        sx={{
          width: '100%',
          aspectRatio: '1 / 1',
          p: { xs: 1.5, sm: 2 },
          borderRadius: '20px',
          bgcolor: isDark ? 'rgba(15, 23, 42, 0.9)' : '#CBD5E1',
          boxShadow: isDark
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.7), inset 0 0 0 1px rgba(255, 255, 255, 0.1)'
            : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows: 'repeat(4, 1fr)',
          gap: { xs: 1.2, sm: 1.8 },
          touchAction: 'none',
        }}
      >
        {grid.map((row, r) =>
          row.map((val, c) => {
            const style = TILE_STYLES[val] || {
              bg: 'linear-gradient(135deg, #1E293B, #0F172A)',
              color: '#FFFFFF',
            };

            return (
              <Box
                key={`${r}-${c}`}
                sx={{
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: val === 0 ? (isDark ? 'rgba(30, 41, 59, 0.5)' : '#E2E8F0') : undefined,
                  background: val > 0 ? style.bg : undefined,
                  boxShadow: val > 0 ? style.shadow : undefined,
                  transition: 'all 0.12s ease-in-out',
                }}
              >
                {val > 0 && (
                  <Typography
                    sx={{
                      fontWeight: 800,
                      fontSize: {
                        xs: val >= 1024 ? '1.25rem' : val >= 128 ? '1.5rem' : '1.9rem',
                        sm: val >= 1024 ? '1.5rem' : val >= 128 ? '1.9rem' : '2.4rem',
                      },
                      color: style.color,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {val}
                  </Typography>
                )}
              </Box>
            );
          })
        )}
      </Box>

      {/* Victory Dialog */}
      <Dialog open={won && !acknowledgedWin} onClose={() => setAcknowledgedWin(true)}>
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 800, fontSize: '1.5rem' }}>
          🎉 You Built 2048!
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Congratulations! You have mastered the grid. You can continue playing for a higher score or start fresh.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2.5, gap: 1 }}>
          <Button variant="outlined" onClick={() => setAcknowledgedWin(true)} sx={{ borderRadius: '8px' }}>
            Keep Going
          </Button>
          <Button variant="contained" onClick={handleRestart} sx={{ borderRadius: '8px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
            Play Again
          </Button>
        </DialogActions>
      </Dialog>

      {/* Game Over Dialog */}
      <Dialog open={gameOver} onClose={() => {}}>
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 800, fontSize: '1.5rem' }}>
          Game Over!
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          <Typography variant="body1" sx={{ color: 'text.secondary', mb: 1 }}>
            No more moves available!
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main' }}>
            Final Score: {score}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2.5, gap: 1 }}>
          <Button variant="outlined" onClick={handleUndo} disabled={history.length === 0} sx={{ borderRadius: '8px' }}>
            Undo Last Move
          </Button>
          <Button variant="contained" onClick={handleRestart} sx={{ borderRadius: '8px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
            Try Again
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
