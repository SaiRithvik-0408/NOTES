// Sudoku Game Engine: Generation, Validation, Backtracking Solver, and Hint System

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface SudokuCell {
  row: number;
  col: number;
  value: number; // 0 represents empty cell
  initial: boolean; // Pre-filled clue from the puzzle start
  notes: number[]; // Candidate numbers (1-9) in pencil mode
  isError?: boolean;
}

export type SudokuBoard = SudokuCell[][];

export interface SudokuPuzzle {
  board: SudokuBoard;
  solution: number[][];
  difficulty: Difficulty;
}

export interface SudokuMove {
  row: number;
  col: number;
  prevValue: number;
  newValue: number;
  prevNotes: number[];
  newNotes: number[];
}

export interface SudokuHint {
  row: number;
  col: number;
  value: number;
  message: string;
}

// Clue counts per difficulty level
const CLUE_COUNTS: Record<Difficulty, number> = {
  easy: 40,
  medium: 32,
  hard: 28,
  expert: 24,
};

/**
 * Checks whether placing a value at board[row][col] is valid
 */
export function isValidPlacement(grid: number[][], row: number, col: number, num: number): boolean {
  for (let c = 0; c < 9; c++) {
    if (c !== col && grid[row][c] === num) return false;
  }

  for (let r = 0; r < 9; r++) {
    if (r !== row && grid[r][col] === num) return false;
  }

  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const curR = startRow + r;
      const curC = startCol + c;
      if ((curR !== row || curC !== col) && grid[curR][curC] === num) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Recursive backtracking solver to generate a complete valid Sudoku board
 */
function fillBoard(grid: number[][]): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) {
        // Randomize 1-9 order for varied board generation
        const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
        for (const num of numbers) {
          if (isValidPlacement(grid, r, c, num)) {
            grid[r][c] = num;
            if (fillBoard(grid)) {
              return true;
            }
            grid[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

/**
 * Solves a sudoku grid and counts number of solutions (stops after 2 for uniqueness check)
 */
function countSolutions(grid: number[][], count = { value: 0 }): number {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) {
        for (let num = 1; num <= 9; num++) {
          if (isValidPlacement(grid, r, c, num)) {
            grid[r][c] = num;
            countSolutions(grid, count);
            grid[r][c] = 0;
            if (count.value >= 2) return count.value;
          }
        }
        return count.value;
      }
    }
  }
  count.value++;
  return count.value;
}

/**
 * Generates a full solved 9x9 board
 */
export function generateSolvedGrid(): number[][] {
  const grid: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));
  fillBoard(grid);
  return grid;
}

/**
 * Generates a new Sudoku puzzle of the specified difficulty
 */
export function generateSudoku(difficulty: Difficulty): SudokuPuzzle {
  const solution = generateSolvedGrid();
  const puzzleGrid: number[][] = solution.map((row) => [...row]);

  const targetClues = CLUE_COUNTS[difficulty];
  const cellsToRemove = 81 - targetClues;

  const positions: [number, number][] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      positions.push([r, c]);
    }
  }
  positions.sort(() => Math.random() - 0.5);

  let removed = 0;
  for (const [r, c] of positions) {
    if (removed >= cellsToRemove) break;

    const backup = puzzleGrid[r][c];
    puzzleGrid[r][c] = 0;

    // Check if the puzzle still has a unique solution
    const copy = puzzleGrid.map((row) => [...row]);
    const solCount = countSolutions(copy, { value: 0 });

    if (solCount === 1) {
      removed++;
    } else {
      // Revert if removal creates ambiguous multiple solutions
      puzzleGrid[r][c] = backup;
    }
  }

  // Construct UI board structure
  const board: SudokuBoard = [];
  for (let r = 0; r < 9; r++) {
    const row: SudokuCell[] = [];
    for (let c = 0; c < 9; c++) {
      const val = puzzleGrid[r][c];
      row.push({
        row: r,
        col: c,
        value: val,
        initial: val !== 0,
        notes: [],
        isError: false,
      });
    }
    board.push(row);
  }

  return {
    board,
    solution,
    difficulty,
  };
}

/**
 * Evaluates the board and marks all cells that conflict in their row, col, or 3x3 block
 */
export function validateBoard(board: SudokuBoard): {
  errorCoords: Set<string>;
  isComplete: boolean;
  isCorrect: boolean;
} {
  const errorCoords = new Set<string>();
  let hasEmpty = false;

  // 1. Check Rows
  for (let r = 0; r < 9; r++) {
    const seen = new Map<number, number[]>();
    for (let c = 0; c < 9; c++) {
      const val = board[r][c].value;
      if (val === 0) {
        hasEmpty = true;
      } else {
        const existing = seen.get(val) || [];
        existing.push(c);
        seen.set(val, existing);
      }
    }
    for (const [, cols] of seen) {
      if (cols.length > 1) {
        cols.forEach((c) => errorCoords.add(`${r},${c}`));
      }
    }
  }

  // 2. Check Columns
  for (let c = 0; c < 9; c++) {
    const seen = new Map<number, number[]>();
    for (let r = 0; r < 9; r++) {
      const val = board[r][c].value;
      if (val !== 0) {
        const existing = seen.get(val) || [];
        existing.push(r);
        seen.set(val, existing);
      }
    }
    for (const [, rows] of seen) {
      if (rows.length > 1) {
        rows.forEach((r) => errorCoords.add(`${r},${c}`));
      }
    }
  }

  // 3. Check 3x3 Blocks
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const seen = new Map<number, [number, number][]>();
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const row = br * 3 + r;
          const col = bc * 3 + c;
          const val = board[row][col].value;
          if (val !== 0) {
            const existing = seen.get(val) || [];
            existing.push([row, col]);
            seen.set(val, existing);
          }
        }
      }
      for (const [, coords] of seen) {
        if (coords.length > 1) {
          coords.forEach(([r, c]) => errorCoords.add(`${r},${c}`));
        }
      }
    }
  }

  const isComplete = !hasEmpty;
  const isCorrect = isComplete && errorCoords.size === 0;

  return { errorCoords, isComplete, isCorrect };
}

/**
 * Finds a smart logical hint or next optimal move
 */
export function getSmartHint(board: SudokuBoard, solution: number[][]): SudokuHint | null {
  // First, look for an erroneous or empty cell
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = board[r][c];
      const sol = solution[r][c];
      if (!cell.initial && (cell.value === 0 || cell.value !== sol)) {
        return {
          row: r,
          col: c,
          value: sol,
          message: `The correct number for row ${r + 1}, column ${c + 1} is ${sol}.`,
        };
      }
    }
  }
  return null;
}

/**
 * Computes how many times each number (1-9) is currently placed on the board
 */
export function getNumberCounts(board: SudokuBoard): Record<number, number> {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = board[r][c].value;
      if (val >= 1 && val <= 9) {
        counts[val]++;
      }
    }
  }
  return counts;
}
