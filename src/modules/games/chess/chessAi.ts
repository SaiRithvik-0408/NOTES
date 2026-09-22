import { Board, GameState, Move, PieceColor, PieceType, AiDifficulty } from './chessTypes';
import { getAllLegalMoves, applyMove } from './chessEngine';

// Base Piece Values (centipawns)
const PIECE_VALUES: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-Square Tables (evaluated from White's perspective; inverted for Black)
const PAWN_TABLE = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 25, 25, 10, 5, 5],
  [0, 0, 0, 20, 20, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -20, -20, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const KNIGHT_TABLE = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
];

const BISHOP_TABLE = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 10, 10, 5, 0, -10],
  [-10, 5, 5, 10, 10, 5, 5, -10],
  [-10, 0, 10, 10, 10, 10, 0, -10],
  [-10, 10, 10, 10, 10, 10, 10, -10],
  [-10, 5, 0, 0, 0, 0, 5, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20],
];

const ROOK_TABLE = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [5, 10, 10, 10, 10, 10, 10, 5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [0, 0, 0, 5, 5, 0, 0, 0],
];

const QUEEN_TABLE = [
  [-20, -10, -10, -5, -5, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 5, 5, 5, 0, -10],
  [-5, 0, 5, 5, 5, 5, 0, -5],
  [0, 0, 5, 5, 5, 5, 0, -5],
  [-10, 5, 5, 5, 5, 5, 0, -10],
  [-10, 0, 5, 0, 0, 0, 0, -10],
  [-20, -10, -10, -5, -5, -10, -10, -20],
];

const KING_TABLE = [
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-20, -30, -30, -40, -40, -30, -30, -20],
  [-10, -20, -20, -20, -20, -20, -20, -10],
  [20, 20, 0, 0, 0, 0, 20, 20],
  [20, 30, 10, 0, 0, 10, 30, 20],
];

function getPstScore(type: PieceType, row: number, col: number, color: PieceColor): number {
  const r = color === 'w' ? row : 7 - row;
  const c = color === 'w' ? col : 7 - col;

  switch (type) {
    case 'p':
      return PAWN_TABLE[r][c];
    case 'n':
      return KNIGHT_TABLE[r][c];
    case 'b':
      return BISHOP_TABLE[r][c];
    case 'r':
      return ROOK_TABLE[r][c];
    case 'q':
      return QUEEN_TABLE[r][c];
    case 'k':
      return KING_TABLE[r][c];
    default:
      return 0;
  }
}

/**
 * Static evaluation function: positive for White advantage, negative for Black.
 */
export function evaluateBoard(board: Board): number {
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const baseVal = PIECE_VALUES[piece.type];
      const posVal = getPstScore(piece.type, r, c, piece.color);
      const totalVal = baseVal + posVal;

      if (piece.color === 'w') {
        score += totalVal;
      } else {
        score -= totalVal;
      }
    }
  }

  return score;
}

/**
 * Minimax algorithm with Alpha-Beta pruning.
 */
function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean
): number {
  if (depth === 0 || state.isCheckmate || state.isStalemate) {
    if (state.isCheckmate) {
      return isMaximizing ? -99999 + (3 - depth) : 99999 - (3 - depth);
    }
    if (state.isStalemate) return 0;
    return evaluateBoard(state.board);
  }

  const legalMoves = getAllLegalMoves(state.turn, state.board, state.enPassantTarget, state.castlingRights);

  // Simple move ordering: captures and checks first
  legalMoves.sort((a, b) => {
    const aVal = a.captured ? PIECE_VALUES[a.captured.type] : 0;
    const bVal = b.captured ? PIECE_VALUES[b.captured.type] : 0;
    return bVal - aVal;
  });

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of legalMoves) {
      const nextState = applyMove(state, move);
      const evaluation = minimax(nextState, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of legalMoves) {
      const nextState = applyMove(state, move);
      const evaluation = minimax(nextState, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

/**
 * Computes the best move for the active AI player.
 */
export function getBestMove(state: GameState, difficulty: AiDifficulty = 'medium'): Move | null {
  const legalMoves = getAllLegalMoves(state.turn, state.board, state.enPassantTarget, state.castlingRights);
  if (legalMoves.length === 0) return null;

  // Easy mode: pick randomly or with mild depth 1
  if (difficulty === 'easy') {
    if (Math.random() < 0.35) {
      return legalMoves[Math.floor(Math.random() * legalMoves.length)];
    }
  }

  const depth = difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1;
  const isWhite = state.turn === 'w';

  let bestMove: Move | null = null;
  let bestScore = isWhite ? -Infinity : Infinity;

  // Shuffle candidate moves slightly for variability
  const shuffled = [...legalMoves].sort(() => Math.random() - 0.5);

  for (const move of shuffled) {
    const nextState = applyMove(state, move);
    const score = minimax(nextState, depth - 1, -Infinity, Infinity, !isWhite);

    if (isWhite) {
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
  }

  return bestMove || legalMoves[0];
}
