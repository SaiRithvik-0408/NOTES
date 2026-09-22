import React, { useState } from 'react';
import { Box, Typography, Paper, Chip, Button, Grid, useTheme } from '@mui/material';
import { SportsEsports, ViewInAr, Star, ExtensionOutlined, Grid4x4, RocketLaunch } from '@mui/icons-material';
import { ChessGame } from './chess/ChessGame';
import { Game2048View } from './puzzle2048/Game2048View';
import { SudokuView } from './sudoku/SudokuView';

export const GamesHub: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [selectedGame, setSelectedGame] = useState<'chess' | '2048' | 'sudoku'>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('chess') || hash.includes('room')) return 'chess';
      if (hash.includes('2048')) return '2048';
      if (hash.includes('sudoku')) return 'sudoku';
    }
    return 'chess';
  });

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
        <SudokuView />
      )}
    </Box>
  );
};
