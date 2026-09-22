import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  useTheme,
} from '@mui/material';
import {
  LightbulbOutlined,
  EditOutlined,
  BackspaceOutlined,
  UndoOutlined,
  RefreshOutlined,
  PlayArrow,
  Pause,
  EmojiEvents,
  TimerOutlined,
  CheckCircleOutline,
} from '@mui/icons-material';
import confetti from 'canvas-confetti';
import {
  Difficulty,
  SudokuBoard,
  SudokuCell,
  SudokuMove,
  generateSudoku,
  validateBoard,
  getSmartHint,
  getNumberCounts,
} from './sudokuEngine';

export const SudokuView: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Game Settings & State
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [board, setBoard] = useState<SudokuBoard>([]);
  const [solution, setSolution] = useState<number[][]>([]);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>([0, 0]);
  const [isPencilMode, setIsPencilMode] = useState<boolean>(false);
  const [history, setHistory] = useState<SudokuMove[]>([]);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [mistakes, setMistakes] = useState<number>(0);
  const [hintMessage, setHintMessage] = useState<string | null>(null);
  const [isVictory, setIsVictory] = useState<boolean>(false);

  // Initialize a fresh game
  const startNewGame = useCallback((diff: Difficulty = difficulty) => {
    const puzzle = generateSudoku(diff);
    setBoard(puzzle.board);
    setSolution(puzzle.solution);
    setSelectedCell([4, 4]); // Start in center
    setHistory([]);
    setTimerSeconds(0);
    setIsPaused(false);
    setMistakes(0);
    setHintMessage(null);
    setIsVictory(false);
  }, [difficulty]);

  useEffect(() => {
    startNewGame(difficulty);
  }, [difficulty, startNewGame]);

  // Timer Tick
  useEffect(() => {
    if (isPaused || isVictory) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaused, isVictory]);

  const formattedTime = useMemo(() => {
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [timerSeconds]);

  // Validation & Error checking
  const { errorCoords, isCorrect } = useMemo(() => {
    if (board.length === 0) return { errorCoords: new Set<string>(), isCorrect: false };
    return validateBoard(board);
  }, [board]);

  // Check victory condition
  useEffect(() => {
    if (isCorrect && !isVictory && board.length > 0) {
      setIsVictory(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [isCorrect, isVictory, board.length]);

  // Current selected cell details
  const selectedNumber = useMemo(() => {
    if (!selectedCell || board.length === 0) return 0;
    const [r, c] = selectedCell;
    return board[r]?.[c]?.value || 0;
  }, [selectedCell, board]);

  // Number counts for keypad helper
  const numberCounts = useMemo(() => {
    if (board.length === 0) return {};
    return getNumberCounts(board);
  }, [board]);

  // Handle cell number placement
  const setCellValue = useCallback(
    (num: number) => {
      if (!selectedCell || board.length === 0 || isPaused || isVictory) return;
      const [r, c] = selectedCell;
      const cell = board[r][c];
      if (cell.initial) return;

      if (isPencilMode && num !== 0) {
        // Toggle note
        const currentNotes = cell.notes || [];
        const newNotes = currentNotes.includes(num)
          ? currentNotes.filter((n) => n !== num)
          : [...currentNotes, num].sort();

        setHistory((prev) => [
          ...prev,
          {
            row: r,
            col: c,
            prevValue: cell.value,
            newValue: cell.value,
            prevNotes: [...currentNotes],
            newNotes: [...newNotes],
          },
        ]);

        const nextBoard = board.map((rowArr, rowIdx) =>
          rowArr.map((item, colIdx) =>
            rowIdx === r && colIdx === c ? { ...item, notes: newNotes } : item
          )
        );
        setBoard(nextBoard);
        return;
      }

      // Normal value entry
      if (cell.value === num) return; // already set

      // Check if this move is a mistake
      const isWrong = num !== 0 && solution.length > 0 && solution[r][c] !== num;
      if (isWrong) {
        setMistakes((prev) => prev + 1);
      }

      setHistory((prev) => [
        ...prev,
        {
          row: r,
          col: c,
          prevValue: cell.value,
          newValue: num,
          prevNotes: [...cell.notes],
          newNotes: [],
        },
      ]);

      const nextBoard = board.map((rowArr, rowIdx) =>
        rowArr.map((item, colIdx) => {
          if (rowIdx === r && colIdx === c) {
            return {
              ...item,
              value: num,
              notes: [],
            };
          }
          // If a number is placed in a cell, auto-clear that note from the same row, col, block
          if (
            num !== 0 &&
            (rowIdx === r ||
              colIdx === c ||
              (Math.floor(rowIdx / 3) === Math.floor(r / 3) &&
                Math.floor(colIdx / 3) === Math.floor(c / 3)))
          ) {
            return {
              ...item,
              notes: item.notes.filter((n) => n !== num),
            };
          }
          return item;
        })
      );

      setBoard(nextBoard);
      setHintMessage(null);
    },
    [selectedCell, board, isPencilMode, isPaused, isVictory, solution]
  );

  // Undo last move
  const handleUndo = useCallback(() => {
    if (history.length === 0 || isPaused || isVictory) return;
    const lastMove = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));

    setBoard((prevBoard) =>
      prevBoard.map((rowArr, r) =>
        rowArr.map((cell, c) => {
          if (r === lastMove.row && c === lastMove.col) {
            return {
              ...cell,
              value: lastMove.prevValue,
              notes: lastMove.prevNotes,
            };
          }
          return cell;
        })
      )
    );
    setSelectedCell([lastMove.row, lastMove.col]);
  }, [history, isPaused, isVictory]);

  // Request a smart hint
  const handleHint = useCallback(() => {
    if (board.length === 0 || solution.length === 0 || isPaused || isVictory) return;
    const hint = getSmartHint(board, solution);
    if (hint) {
      setSelectedCell([hint.row, hint.col]);
      setHintMessage(hint.message);
      setCellValue(hint.value);
    } else {
      setHintMessage('Every placed number matches the solution perfectly! Keep going!');
    }
  }, [board, solution, isPaused, isVictory, setCellValue]);

  // Keyboard navigation & number entry
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPaused || isVictory || !selectedCell) return;
      const [r, c] = selectedCell;

      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        setCellValue(parseInt(e.key, 10));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        setCellValue(0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCell([Math.max(0, r - 1), c]);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCell([Math.min(8, r + 1), c]);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedCell([r, Math.max(0, c - 1)]);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedCell([r, Math.min(8, c + 1)]);
      } else if (e.key.toLowerCase() === 'n') {
        setIsPencilMode((prev) => !prev);
      } else if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, isPaused, isVictory, setCellValue, handleUndo]);

  return (
    <Box sx={{ width: '100%', maxWidth: 860, mx: 'auto', p: { xs: 1, sm: 2 } }}>
      {/* Top Bar: Difficulty, Timer, Mistakes */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: '16px',
          bgcolor: isDark ? 'rgba(15, 23, 42, 0.65)' : '#FFFFFF',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        {/* Difficulty Selector */}
        <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', py: 0.5 }}>
          {(['easy', 'medium', 'hard', 'expert'] as Difficulty[]).map((diff) => (
            <Chip
              key={diff}
              label={diff.toUpperCase()}
              clickable
              color={difficulty === diff ? 'primary' : 'default'}
              variant={difficulty === diff ? 'filled' : 'outlined'}
              onClick={() => {
                setDifficulty(diff);
                startNewGame(diff);
              }}
              sx={{
                fontWeight: 700,
                fontSize: '0.75rem',
                textTransform: 'capitalize',
                transition: 'all 0.2s',
              }}
            />
          ))}
        </Stack>

        {/* Stats: Timer & Mistakes */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.8,
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
              px: 1.8,
              py: 0.8,
              borderRadius: '10px',
            }}
          >
            <TimerOutlined sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.95rem' }}>
              {formattedTime}
            </Typography>
            <IconButton size="small" onClick={() => setIsPaused((prev) => !prev)}>
              {isPaused ? <PlayArrow sx={{ fontSize: 18 }} /> : <Pause sx={{ fontSize: 18 }} />}
            </IconButton>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.6,
              bgcolor: mistakes > 0 ? 'rgba(239, 68, 68, 0.15)' : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
              color: mistakes > 0 ? '#EF4444' : 'inherit',
              px: 1.5,
              py: 0.8,
              borderRadius: '10px',
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              Mistakes:
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800 }}>
              {mistakes}
            </Typography>
          </Box>

          <Tooltip title="Start New Puzzle">
            <IconButton onClick={() => startNewGame()} color="primary">
              <RefreshOutlined />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {/* Hint Alert (if active) */}
      {hintMessage && (
        <Paper
          sx={{
            mb: 2,
            p: 1.5,
            borderRadius: '12px',
            bgcolor: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <LightbulbOutlined sx={{ color: '#818CF8' }} />
          <Typography variant="body2" sx={{ color: '#E2E8F0', fontWeight: 600 }}>
            {hintMessage}
          </Typography>
        </Paper>
      )}

      {/* Main Grid & Side Controls */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'center', md: 'flex-start' },
          justifyContent: 'center',
          gap: { xs: 3, md: 4 },
        }}
      >
        {/* 9x9 Sudoku Grid */}
        <Paper
          elevation={isDark ? 8 : 2}
          sx={{
            p: { xs: 1, sm: 1.5 },
            borderRadius: '20px',
            bgcolor: isDark ? '#0B0F19' : '#FFFFFF',
            border: `2px solid ${isDark ? '#334155' : '#CBD5E1'}`,
            display: 'inline-block',
            position: 'relative',
          }}
        >
          {isPaused && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: isDark ? 'rgba(11, 15, 25, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)',
                zIndex: 10,
                borderRadius: '18px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Game Paused
              </Typography>
              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={() => setIsPaused(false)}
                sx={{
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                  fontWeight: 700,
                  px: 3,
                }}
              >
                Resume
              </Button>
            </Box>
          )}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(9, 1fr)',
              gap: '1px',
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            {board.map((row, r) =>
              row.map((cell, c) => {
                const isSelected = selectedCell?.[0] === r && selectedCell?.[1] === c;
                const isSameRowColBlock =
                  selectedCell &&
                  (selectedCell[0] === r ||
                    selectedCell[1] === c ||
                    (Math.floor(selectedCell[0] / 3) === Math.floor(r / 3) &&
                      Math.floor(selectedCell[1] / 3) === Math.floor(c / 3)));
                const isSameNumber = selectedNumber > 0 && cell.value === selectedNumber;
                const isError = errorCoords.has(`${r},${c}`);

                // 3x3 block visual borders
                const borderRight = c === 2 || c === 5 ? `3px solid ${isDark ? '#64748B' : '#94A3B8'}` : undefined;
                const borderBottom = r === 2 || r === 5 ? `3px solid ${isDark ? '#64748B' : '#94A3B8'}` : undefined;

                // Background styling based on selection state
                let cellBg = isDark ? '#0F172A' : '#F8FAFC';
                if (isSelected) {
                  cellBg = isDark ? '#312E81' : '#C7D2FE';
                } else if (isError) {
                  cellBg = 'rgba(239, 68, 68, 0.25)';
                } else if (isSameNumber) {
                  cellBg = isDark ? '#1E1B4B' : '#E0E7FF';
                } else if (isSameRowColBlock) {
                  cellBg = isDark ? '#1E293B' : '#F1F5F9';
                }

                return (
                  <Box
                    key={`${r}-${c}`}
                    onClick={() => setSelectedCell([r, c])}
                    sx={{
                      width: { xs: 34, sm: 46, md: 52 },
                      height: { xs: 34, sm: 46, md: 52 },
                      bgcolor: cellBg,
                      borderRight,
                      borderBottom,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      userSelect: 'none',
                      position: 'relative',
                      transition: 'background-color 0.15s ease',
                      outline: isSelected ? '2px solid #818CF8' : 'none',
                      zIndex: isSelected ? 2 : 1,
                    }}
                  >
                    {cell.value > 0 ? (
                      <Typography
                        variant="body1"
                        sx={{
                          fontWeight: cell.initial ? 900 : 700,
                          fontSize: { xs: '1rem', sm: '1.25rem', md: '1.4rem' },
                          color: isError
                            ? '#EF4444'
                            : cell.initial
                            ? isDark
                              ? '#F8FAFC'
                              : '#0F172A'
                            : '#818CF8',
                        }}
                      >
                        {cell.value}
                      </Typography>
                    ) : cell.notes && cell.notes.length > 0 ? (
                      // 3x3 Mini Grid for Pencil Notes
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gridTemplateRows: 'repeat(3, 1fr)',
                          width: '100%',
                          height: '100%',
                          p: '2px',
                        }}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                          <Typography
                            key={n}
                            variant="caption"
                            sx={{
                              fontSize: { xs: '0.55rem', sm: '0.65rem' },
                              lineHeight: 1,
                              textAlign: 'center',
                              color: cell.notes.includes(n)
                                ? isDark
                                  ? '#94A3B8'
                                  : '#64748B'
                                : 'transparent',
                              fontWeight: 600,
                            }}
                          >
                            {cell.notes.includes(n) ? n : ''}
                          </Typography>
                        ))}
                      </Box>
                    ) : null}
                  </Box>
                );
              })
            )}
          </Box>
        </Paper>

        {/* Action Controls & Keypad */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, width: { xs: '100%', sm: 300 } }}>
          {/* Action Tools: Undo, Erase, Pencil, Hint */}
          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              borderRadius: '16px',
              bgcolor: isDark ? 'rgba(15, 23, 42, 0.65)' : '#FFFFFF',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 1,
            }}
          >
            <Tooltip title="Undo (Ctrl+Z)">
              <Button
                variant="outlined"
                onClick={handleUndo}
                disabled={history.length === 0}
                sx={{
                  flexDirection: 'column',
                  py: 1,
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'none',
                }}
              >
                <UndoOutlined sx={{ fontSize: 20, mb: 0.3 }} />
                Undo
              </Button>
            </Tooltip>

            <Tooltip title="Erase Cell (Delete / Backspace)">
              <Button
                variant="outlined"
                onClick={() => setCellValue(0)}
                sx={{
                  flexDirection: 'column',
                  py: 1,
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'none',
                }}
              >
                <BackspaceOutlined sx={{ fontSize: 20, mb: 0.3 }} />
                Erase
              </Button>
            </Tooltip>

            <Tooltip title="Toggle Pencil / Notes Mode (N)">
              <Button
                variant={isPencilMode ? 'contained' : 'outlined'}
                onClick={() => setIsPencilMode((prev) => !prev)}
                color={isPencilMode ? 'secondary' : 'primary'}
                sx={{
                  flexDirection: 'column',
                  py: 1,
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'none',
                }}
              >
                <EditOutlined sx={{ fontSize: 20, mb: 0.3 }} />
                Notes {isPencilMode ? 'ON' : 'OFF'}
              </Button>
            </Tooltip>

            <Tooltip title="Get a Smart Clue">
              <Button
                variant="outlined"
                onClick={handleHint}
                sx={{
                  flexDirection: 'column',
                  py: 1,
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  color: '#F59E0B',
                  borderColor: 'rgba(245, 158, 11, 0.4)',
                  '&:hover': {
                    borderColor: '#F59E0B',
                    bgcolor: 'rgba(245, 158, 11, 0.08)',
                  },
                }}
              >
                <LightbulbOutlined sx={{ fontSize: 20, mb: 0.3 }} />
                Hint
              </Button>
            </Tooltip>
          </Paper>

          {/* 1-9 Number Keypad */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: '16px',
              bgcolor: isDark ? 'rgba(15, 23, 42, 0.65)' : '#FFFFFF',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1.5,
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
              const placed = numberCounts[num] || 0;
              const isAllPlaced = placed >= 9;

              return (
                <Button
                  key={num}
                  variant="outlined"
                  onClick={() => setCellValue(num)}
                  disabled={isAllPlaced && !isPencilMode}
                  sx={{
                    height: 54,
                    borderRadius: '14px',
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    position: 'relative',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.15)',
                    color: isDark ? '#FFFFFF' : '#0F172A',
                    bgcolor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#F8FAFC',
                    '&:hover': {
                      bgcolor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
                      borderColor: 'primary.main',
                    },
                  }}
                >
                  {num}
                  {/* Remaining badge */}
                  <Typography
                    variant="caption"
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 8,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      color: isAllPlaced ? '#10B981' : 'text.secondary',
                    }}
                  >
                    {isAllPlaced ? '✓' : 9 - placed}
                  </Typography>
                </Button>
              );
            })}
          </Paper>
        </Box>
      </Box>

      {/* Victory Dialog */}
      <Dialog
        open={isVictory}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            p: 2,
            textAlign: 'center',
            bgcolor: isDark ? '#0F1626' : '#FFFFFF',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <EmojiEvents sx={{ fontSize: 56, color: '#F59E0B', mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Sudoku Completed!
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Brilliant work! You completed the <strong>{difficulty.toUpperCase()}</strong> puzzle in{' '}
            <strong>{formattedTime}</strong> with <strong>{mistakes}</strong> mistake(s).
          </Typography>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              gap: 2,
              p: 2,
              borderRadius: '12px',
              bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            }}
          >
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Difficulty
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {difficulty.toUpperCase()}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Time Taken
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>
                {formattedTime}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button
            variant="contained"
            onClick={() => startNewGame()}
            sx={{
              borderRadius: '12px',
              fontWeight: 700,
              px: 4,
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            }}
          >
            Play Another Puzzle
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
