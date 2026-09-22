export type Grid2048 = number[][];
export type Direction2048 = 'up' | 'down' | 'left' | 'right';

export interface MoveResult2048 {
  grid: Grid2048;
  scoreGained: number;
  moved: boolean;
  isGameOver: boolean;
  hasWon: boolean;
}

/**
 * Creates an empty 4x4 grid
 */
export function createEmptyGrid(): Grid2048 {
  return [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
}

/**
 * Adds a new random tile (90% chance 2, 10% chance 4) to an empty spot
 */
export function addRandomTile(grid: Grid2048): Grid2048 {
  const emptyCoords: [number, number][] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r][c] === 0) {
        emptyCoords.push([r, c]);
      }
    }
  }

  if (emptyCoords.length === 0) return grid;

  const [randR, randC] = emptyCoords[Math.floor(Math.random() * emptyCoords.length)];
  const newTileValue = Math.random() < 0.9 ? 2 : 4;

  const newGrid = grid.map((row) => [...row]);
  newGrid[randR][randC] = newTileValue;
  return newGrid;
}

/**
 * Initializes a new 2048 game grid with 2 starting tiles
 */
export function initGame2048(): Grid2048 {
  const empty = createEmptyGrid();
  const withFirst = addRandomTile(empty);
  return addRandomTile(withFirst);
}

/**
 * Slides and merges a single 4-element row to the left
 */
function slideAndMergeRow(row: number[]): { newRow: number[]; score: number; changed: boolean } {
  // 1. Filter out zeros
  const nonZeros = row.filter((val) => val !== 0);
  const newRow: number[] = [];
  let score = 0;
  let changed = false;

  let i = 0;
  while (i < nonZeros.length) {
    if (i + 1 < nonZeros.length && nonZeros[i] === nonZeros[i + 1]) {
      const mergedVal = nonZeros[i] * 2;
      newRow.push(mergedVal);
      score += mergedVal;
      i += 2; // Skip both merged tiles
      changed = true;
    } else {
      newRow.push(nonZeros[i]);
      i++;
    }
  }

  // Pad back with zeros to length 4
  while (newRow.length < 4) {
    newRow.push(0);
  }

  // Check if row changed from original
  for (let idx = 0; idx < 4; idx++) {
    if (row[idx] !== newRow[idx]) {
      changed = true;
      break;
    }
  }

  return { newRow, score, changed };
}

/**
 * Rotates a 4x4 matrix 90 degrees clockwise
 */
function rotateClockwise(grid: Grid2048): Grid2048 {
  const rotated = createEmptyGrid();
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      rotated[c][3 - r] = grid[r][c];
    }
  }
  return rotated;
}

/**
 * Rotates a 4x4 matrix 90 degrees counter-clockwise
 */
function rotateCounterClockwise(grid: Grid2048): Grid2048 {
  const rotated = createEmptyGrid();
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      rotated[3 - c][r] = grid[r][c];
    }
  }
  return rotated;
}

/**
 * Checks if there are any legal moves left on the board
 */
export function checkGameOver(grid: Grid2048): boolean {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r][c] === 0) return false; // Found empty cell
      // Check horizontal neighbor
      if (c + 1 < 4 && grid[r][c] === grid[r][c + 1]) return false;
      // Check vertical neighbor
      if (r + 1 < 4 && grid[r][c] === grid[r + 1][c]) return false;
    }
  }
  return true;
}

/**
 * Checks if the board contains a 2048 tile (or higher)
 */
export function hasWon2048(grid: Grid2048): boolean {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r][c] >= 2048) return true;
    }
  }
  return false;
}

/**
 * Performs a move in one of the 4 cardinal directions
 */
export function makeMove2048(grid: Grid2048, direction: Direction2048): MoveResult2048 {
  let workingGrid = grid.map((row) => [...row]);
  let scoreGained = 0;
  let anyChanged = false;

  // Transform matrix so we can always slide left
  if (direction === 'up') {
    workingGrid = rotateCounterClockwise(workingGrid);
  } else if (direction === 'right') {
    workingGrid = workingGrid.map((row) => [...row].reverse());
  } else if (direction === 'down') {
    workingGrid = rotateClockwise(workingGrid);
  }

  // Slide each row left
  const processedRows: number[][] = [];
  for (let r = 0; r < 4; r++) {
    const { newRow, score, changed } = slideAndMergeRow(workingGrid[r]);
    processedRows.push(newRow);
    scoreGained += score;
    if (changed) anyChanged = true;
  }
  workingGrid = processedRows;

  // Invert transformations back to original orientation
  if (direction === 'up') {
    workingGrid = rotateClockwise(workingGrid);
  } else if (direction === 'right') {
    workingGrid = workingGrid.map((row) => [...row].reverse());
  } else if (direction === 'down') {
    workingGrid = rotateCounterClockwise(workingGrid);
  }

  let finalGrid = workingGrid;
  if (anyChanged) {
    finalGrid = addRandomTile(finalGrid);
  }

  return {
    grid: finalGrid,
    scoreGained,
    moved: anyChanged,
    isGameOver: checkGameOver(finalGrid),
    hasWon: hasWon2048(finalGrid),
  };
}
