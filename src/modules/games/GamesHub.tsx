import React, { useState } from 'react';
import { Box, Typography, Paper, Chip, Button, Grid, useTheme } from '@mui/material';
import { SportsEsports, ViewInAr, Star, ExtensionOutlined, Grid4x4, RocketLaunch } from '@mui/icons-material';
import { ChessGame } from './chess/ChessGame';
import { Game2048View } from './puzzle2048/Game2048View';

export const GamesHub: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [selectedGame, setSelectedGame] = useState<'chess' | '2048' | 'sudoku'>('chess');

  return (
    <Box sx={{ width: '100%', minHeight: 'calc(100vh - 120px)', pb: 6 }}>
      {/* Featured Header Banner */}
      <Box
        sx={{
          mb: 4,
          p: { xs: 2.5, md: 3.5 },
          borderRadius: '20px',
          background: isDark
            ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.08) 50%, rgba(15, 23, 42, 0.6) 100%)'
            : 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.04) 50%, #FFFFFF 100%)',
          border: `1px solid ${isDark ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.15)'}`,
          boxShadow: isDark
            ? '0 20px 40px -15px rgba(0, 0, 0, 0.5)'
            : '0 20px 40px -15px rgba(99, 102, 241, 0.1)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <SportsEsports sx={{ color: 'primary.main', fontSize: 28 }} />
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              Nexus Arcade & Games
            </Typography>
            <Chip
              icon={<ViewInAr sx={{ fontSize: '14px !important' }} />}
              label="3D UI Powered"
              size="small"
              sx={{
                bgcolor: 'rgba(99, 102, 241, 0.2)',
                color: '#818CF8',
                fontWeight: 700,
                fontSize: '0.72rem',
              }}
            />
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 620 }}>
            Take a mental break from note-taking with local-first interactive games. Featuring full custom piece-rule chess with 3D WebGL boards, AI bot opponents, and responsive gameplay.
          </Typography>
        </Box>

        {/* Game Selector Tabs */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant={selectedGame === 'chess' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setSelectedGame('chess')}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.8rem',
              px: 2,
              background:
                selectedGame === 'chess'
                  ? 'linear-gradient(135deg, #6366F1, #8B5CF6)'
                  : undefined,
            }}
          >
            ♟️ 3D Chess
          </Button>

          <Button
            variant={selectedGame === '2048' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setSelectedGame('2048')}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.8rem',
              px: 2,
            }}
          >
            🧩 2048
          </Button>

          <Button
            variant={selectedGame === 'sudoku' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setSelectedGame('sudoku')}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.8rem',
              px: 2,
            }}
          >
            🔢 Sudoku
          </Button>
        </Box>
      </Box>

      {/* Active Game Display */}
      {selectedGame === 'chess' ? (
        <ChessGame />
      ) : selectedGame === '2048' ? (
        <Game2048View />
      ) : (
        <Paper
          elevation={0}
          sx={{
            p: 6,
            textAlign: 'center',
            borderRadius: '20px',
            bgcolor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#FFFFFF',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
            maxWidth: 600,
            mx: 'auto',
          }}
        >
          <ExtensionOutlined sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
            Sudoku Master
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            Sudoku Master is currently queued in Task 3 of development! In the meantime, enjoy 3D Chess and the newly launched 2048 Puzzle.
          </Typography>
          <Button
            variant="contained"
            onClick={() => setSelectedGame('chess')}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            }}
          >
            Play 3D Chess Now
          </Button>
        </Paper>
      )}
    </Box>
  );
};
