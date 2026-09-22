import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { Board, Move, Piece, PieceColor, Position } from './chessTypes';

interface Chess2DViewProps {
  board: Board;
  turn: PieceColor;
  selectedPos: Position | null;
  legalMoves: Move[];
  lastMove: Move | null;
  activeHint?: Move | null;
  isCheck: boolean;
  isFlipped: boolean;
  onSelectSquare: (pos: Position) => void;
}

// Crisp stylized Unicode piece symbols with rich drop-shadows
const PIECE_SYMBOLS: Record<PieceColor, Record<string, string>> = {
  w: {
    k: '♔',
    q: '♕',
    r: '♖',
    b: '♗',
    n: '♘',
    p: '♙',
  },
  b: {
    k: '♚',
    q: '♛',
    r: '♜',
    b: '♝',
    n: '♞',
    p: '♟',
  },
};

export const Chess2DView: React.FC<Chess2DViewProps> = ({
  board,
  turn,
  selectedPos,
  legalMoves,
  lastMove,
  activeHint,
  isCheck,
  isFlipped,
  onSelectSquare,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Files & Ranks for coordinates
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  const displayFiles = isFlipped ? [...files].reverse() : files;
  const displayRanks = isFlipped ? [...ranks].reverse() : ranks;

  // Board colors
  const lightSquareColor = isDark ? '#E2E8F0' : '#F1F5F9';
  const darkSquareColor = isDark ? '#475569' : '#64748B';

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 580,
        aspectRatio: '1 / 1',
        mx: 'auto',
        p: { xs: 1, sm: 2 },
        borderRadius: '16px',
        bgcolor: isDark ? 'rgba(15, 23, 42, 0.85)' : '#FFFFFF',
        boxShadow: isDark
          ? '0 20px 40px -15px rgba(0, 0, 0, 0.7), inset 0 0 0 1px rgba(255, 255, 255, 0.1)'
          : '0 20px 40px -15px rgba(0, 0, 0, 0.15), inset 0 0 0 1px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      <Box
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gridTemplateRows: 'repeat(8, 1fr)',
          borderRadius: '10px',
          overflow: 'hidden',
          border: `2px solid ${isDark ? '#334155' : '#CBD5E1'}`,
        }}
      >
        {Array.from({ length: 64 }).map((_, idx) => {
          const gridRow = Math.floor(idx / 8);
          const gridCol = idx % 8;

          const r = isFlipped ? 7 - gridRow : gridRow;
          const c = isFlipped ? 7 - gridCol : gridCol;

          const piece = board[r][c];
          const isLight = (r + c) % 2 === 0;

          const isSelected = selectedPos && selectedPos[0] === r && selectedPos[1] === c;
          const isHintFrom = activeHint && activeHint.from[0] === r && activeHint.from[1] === c;
          const isHintTo = activeHint && activeHint.to[0] === r && activeHint.to[1] === c;
          const legalTarget = legalMoves.find((m) => m.to[0] === r && m.to[1] === c);
          const isLastMoveFrom = lastMove && lastMove.from[0] === r && lastMove.from[1] === c;
          const isLastMoveTo = lastMove && lastMove.to[0] === r && lastMove.to[1] === c;
          const isKingCheck = isCheck && piece?.type === 'k' && piece?.color === turn;

          // Compute square background
          let squareBg = isLight ? lightSquareColor : darkSquareColor;
          if (isSelected) {
            squareBg = '#FBBF24'; // Amber highlight
          } else if (isHintFrom || isHintTo) {
            squareBg = isHintFrom ? '#10B981' : '#34D399'; // Emerald green hint highlight
          } else if (isKingCheck) {
            squareBg = '#EF4444'; // Red check danger
          } else if (isLastMoveFrom || isLastMoveTo) {
            squareBg = isLight ? '#BAE6FD' : '#0284C7'; // Blue last move
          }

          return (
            <Box
              key={`${r}-${c}`}
              onClick={() => onSelectSquare([r, c])}
              sx={{
                position: 'relative',
                bgcolor: squareBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
                '&:hover': {
                  filter: 'brightness(1.08)',
                },
              }}
            >
              {/* Coordinate notations (bottom-right / top-left) */}
              {gridCol === 0 && (
                <Typography
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    top: 2,
                    left: 4,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: isLight ? '#64748B' : '#E2E8F0',
                    lineHeight: 1,
                  }}
                >
                  {displayRanks[gridRow]}
                </Typography>
              )}
              {gridRow === 7 && (
                <Typography
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    bottom: 2,
                    right: 4,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: isLight ? '#64748B' : '#E2E8F0',
                    lineHeight: 1,
                  }}
                >
                  {displayFiles[gridCol]}
                </Typography>
              )}

              {/* Piece Glyph */}
              {piece && (
                <Typography
                  sx={{
                    fontSize: { xs: '2rem', sm: '2.8rem', md: '3.2rem' },
                    lineHeight: 1,
                    color: piece.color === 'w' ? '#FFFFFF' : '#0F172A',
                    filter:
                      piece.color === 'w'
                        ? 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 1px #000000)'
                        : 'drop-shadow(0 2px 3px rgba(255, 255, 255, 0.3)) drop-shadow(0 0 1px #FFFFFF)',
                    transform: isSelected ? 'scale(1.15) translateY(-4px)' : 'none',
                    transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    zIndex: 2,
                  }}
                >
                  {PIECE_SYMBOLS[piece.color][piece.type]}
                </Typography>
              )}

              {/* Legal Move Indicator (Dot for move, Ring for capture) */}
              {legalTarget && !piece && (
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    bgcolor: 'rgba(99, 102, 241, 0.65)',
                    zIndex: 3,
                    boxShadow: '0 0 8px rgba(99, 102, 241, 0.5)',
                  }}
                />
              )}
              {legalTarget && piece && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 4,
                    borderRadius: '50%',
                    border: '3px solid rgba(239, 68, 68, 0.85)',
                    boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)',
                    zIndex: 3,
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
