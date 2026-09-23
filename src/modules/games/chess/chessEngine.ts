import {
  Piece,
  PieceColor,
  PieceType,
  Position,
  Board,
  Move,
  GameState,
  CastlingRights,
} from './chessTypes';

export type {
  Piece,
  PieceColor,
  PieceType,
  Position,
  Board,
  Move,
  GameState,
  CastlingRights,
};

/**
 * Initializes a standard 8x8 chess starting position.
 */
export function createInitialBoard(): Board {
  const board: Board = Array(8)
    .fill(null)
    .map(() => Array(8).fill(null));

  const backRank: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

  // Black pieces (rows 0 and 1)
  for (let c = 0; c < 8; c++) {
    board[0][c] = { id: `b-${backRank[c]}-${c}`, type: backRank[c], color: 'b', hasMoved: false };
    board[1][c] = { id: `b-p-${c}`, type: 'p', color: 'b', hasMoved: false };
  }

  // White pieces (rows 6 and 7)
  for (let c = 0; c < 8; c++) {
    board[6][c] = { id: `w-p-${c}`, type: 'p', color: 'w', hasMoved: false };
    board[7][c] = { id: `w-${backRank[c]}-${c}`, type: backRank[c], color: 'w', hasMoved: false };
  }

  return board;
}

/**
 * Initializes a new GameState.
 */
export function createInitialGameState(): GameState {
  const board = createInitialBoard();
  return {
    board,
    turn: 'w',
    selectedPos: null,
    legalMoves: [],
    moveHistory: [],
    capturedWhite: [],
    capturedBlack: [],
    enPassantTarget: null,
    castlingRights: {
      w: { kingside: true, queenside: true },
      b: { kingside: true, queenside: true },
    },
    halfMoves: 0,
    fullMoves: 1,
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    winner: null,
  };
}

/**
 * Checks if a position is within the 8x8 chess board.
 */
export function isInsideBoard(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

/**
 * Deep clones an 8x8 chess board.
 */
export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

// =========================================================================
// PIECE LOGIC FUNCTIONS (Dedicated rule functions for every type of piece)
// =========================================================================

/**
 * PAWN LOGIC:
 * - 1 step forward (empty square)
 * - 2 steps forward from starting rank (row 6 for White, row 1 for Black)
 * - 1 step diagonal capture
 * - En Passant capture
 * - Promotion flag when reaching the last rank
 */
export function getPawnMoves(
  pos: Position,
  piece: Piece,
  board: Board,
  enPassantTarget: Position | null
): Move[] {
  const moves: Move[] = [];
  const [row, col] = pos;
  const dir = piece.color === 'w' ? -1 : 1;
  const startRow = piece.color === 'w' ? 6 : 1;
  const promoRow = piece.color === 'w' ? 0 : 7;

  // 1. Single step forward
  const oneAhead = row + dir;
  if (isInsideBoard(oneAhead, col) && !board[oneAhead][col]) {
    const isPromo = oneAhead === promoRow;
    if (isPromo) {
      const promos: PieceType[] = ['q', 'r', 'b', 'n'];
      for (const p of promos) {
        moves.push({ from: pos, to: [oneAhead, col], piece, promotion: p });
      }
    } else {
      moves.push({ from: pos, to: [oneAhead, col], piece });
    }

    // 2. Double step forward from starting rank
    const twoAhead = row + 2 * dir;
    if (row === startRow && !board[twoAhead][col]) {
      moves.push({ from: pos, to: [twoAhead, col], piece });
    }
  }

  // 3. Diagonal captures & En Passant
  for (const dCol of [-1, 1]) {
    const targetCol = col + dCol;
    const targetRow = row + dir;

    if (!isInsideBoard(targetRow, targetCol)) continue;

    const targetPiece = board[targetRow][targetCol];

    // Standard diagonal capture
    if (targetPiece && targetPiece.color !== piece.color) {
      if (targetRow === promoRow) {
        const promos: PieceType[] = ['q', 'r', 'b', 'n'];
        for (const p of promos) {
          moves.push({
            from: pos,
            to: [targetRow, targetCol],
            piece,
            captured: targetPiece,
            promotion: p,
          });
        }
      } else {
        moves.push({
          from: pos,
          to: [targetRow, targetCol],
          piece,
          captured: targetPiece,
        });
      }
    }

    // En Passant capture
    if (
      !targetPiece &&
      enPassantTarget &&
      enPassantTarget[0] === targetRow &&
      enPassantTarget[1] === targetCol
    ) {
      const victimRow = row; // The pawn being captured is on the same row as current pawn
      const capturedPawn = board[victimRow][targetCol];
      if (capturedPawn && capturedPawn.color !== piece.color && capturedPawn.type === 'p') {
        moves.push({
          from: pos,
          to: [targetRow, targetCol],
          piece,
          captured: capturedPawn,
          isEnPassant: true,
        });
      }
    }
  }

  return moves;
}

/**
 * KNIGHT LOGIC:
 * - 8 L-shape jump vectors: 2 in one axis, 1 in the other
 * - Can jump over any pieces
 * - Captures enemy pieces, blocked by friendly pieces
 */
export function getKnightMoves(pos: Position, piece: Piece, board: Board): Move[] {
  const moves: Move[] = [];
  const [row, col] = pos;

  const offsets = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];

  for (const [dRow, dCol] of offsets) {
    const targetRow = row + dRow;
    const targetCol = col + dCol;

    if (!isInsideBoard(targetRow, targetCol)) continue;

    const destPiece = board[targetRow][targetCol];
    if (!destPiece) {
      moves.push({ from: pos, to: [targetRow, targetCol], piece });
    } else if (destPiece.color !== piece.color) {
      moves.push({ from: pos, to: [targetRow, targetCol], piece, captured: destPiece });
    }
  }

  return moves;
}

/**
 * BISHOP LOGIC:
 * - Slides diagonally along 4 rays
 * - Blocked by friendly pieces; captures enemy pieces and stops
 */
export function getBishopMoves(pos: Position, piece: Piece, board: Board): Move[] {
  const moves: Move[] = [];
  const [row, col] = pos;

  const directions = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];

  for (const [dRow, dCol] of directions) {
    let r = row + dRow;
    let c = col + dCol;

    while (isInsideBoard(r, c)) {
      const destPiece = board[r][c];
      if (!destPiece) {
        moves.push({ from: pos, to: [r, c], piece });
      } else {
        if (destPiece.color !== piece.color) {
          moves.push({ from: pos, to: [r, c], piece, captured: destPiece });
        }
        break; // Obstacle encountered, ray terminates
      }
      r += dRow;
      c += dCol;
    }
  }

  return moves;
}

/**
 * ROOK LOGIC:
 * - Slides orthogonally along 4 rays (horizontal and vertical)
 * - Blocked by friendly pieces; captures enemy pieces and stops
 */
export function getRookMoves(pos: Position, piece: Piece, board: Board): Move[] {
  const moves: Move[] = [];
  const [row, col] = pos;

  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  for (const [dRow, dCol] of directions) {
    let r = row + dRow;
    let c = col + dCol;

    while (isInsideBoard(r, c)) {
      const destPiece = board[r][c];
      if (!destPiece) {
        moves.push({ from: pos, to: [r, c], piece });
      } else {
        if (destPiece.color !== piece.color) {
          moves.push({ from: pos, to: [r, c], piece, captured: destPiece });
        }
        break;
      }
      r += dRow;
      c += dCol;
    }
  }

  return moves;
}

/**
 * QUEEN LOGIC:
 * - Combines the movement of Rook and Bishop (8 sliding directions)
 */
export function getQueenMoves(pos: Position, piece: Piece, board: Board): Move[] {
  return [...getRookMoves(pos, piece, board), ...getBishopMoves(pos, piece, board)];
}

/**
 * KING LOGIC:
 * - 1 step in any of the 8 directions
 * - Castling (Kingside and Queenside) when eligible
 */
export function getKingMoves(
  pos: Position,
  piece: Piece,
  board: Board,
  castlingRights: CastlingRights
): Move[] {
  const moves: Move[] = [];
  const [row, col] = pos;

  const offsets = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];

  for (const [dRow, dCol] of offsets) {
    const targetRow = row + dRow;
    const targetCol = col + dCol;

    if (!isInsideBoard(targetRow, targetCol)) continue;

    const destPiece = board[targetRow][targetCol];
    if (!destPiece) {
      moves.push({ from: pos, to: [targetRow, targetCol], piece });
    } else if (destPiece.color !== piece.color) {
      moves.push({ from: pos, to: [targetRow, targetCol], piece, captured: destPiece });
    }
  }

  // Castling logic
  const rights = castlingRights[piece.color];
  const homeRow = piece.color === 'w' ? 7 : 0;
  const oppColor: PieceColor = piece.color === 'w' ? 'b' : 'w';

  if (row === homeRow && col === 4) {
    // Current king must NOT be in check to castle
    const currentlyInCheck = isSquareAttacked([homeRow, 4], oppColor, board);

    if (!currentlyInCheck) {
      // 1. Kingside castling (O-O) -> squares 5 and 6 must be empty and unattacked, rook on col 7
      if (rights.kingside) {
        const rook = board[homeRow][7];
        if (
          rook &&
          rook.type === 'r' &&
          rook.color === piece.color &&
          !board[homeRow][5] &&
          !board[homeRow][6] &&
          !isSquareAttacked([homeRow, 5], oppColor, board) &&
          !isSquareAttacked([homeRow, 6], oppColor, board)
        ) {
          moves.push({
            from: pos,
            to: [homeRow, 6],
            piece,
            isCastling: 'kingside',
          });
        }
      }

      // 2. Queenside castling (O-O-O) -> squares 1, 2, 3 must be empty, 2 and 3 unattacked, rook on col 0
      if (rights.queenside) {
        const rook = board[homeRow][0];
        if (
          rook &&
          rook.type === 'r' &&
          rook.color === piece.color &&
          !board[homeRow][1] &&
          !board[homeRow][2] &&
          !board[homeRow][3] &&
          !isSquareAttacked([homeRow, 2], oppColor, board) &&
          !isSquareAttacked([homeRow, 3], oppColor, board)
        ) {
          moves.push({
            from: pos,
            to: [homeRow, 2],
            piece,
            isCastling: 'queenside',
          });
        }
      }
    }
  }

  return moves;
}

// =========================================================================
// ATTACK & CHECK DETECTION
// =========================================================================

/**
 * Checks if a given square is attacked by any piece of attackerColor.
 */
export function isSquareAttacked(square: Position, attackerColor: PieceColor, board: Board): boolean {
  const [row, col] = square;

  // 1. Check pawn attacks
  const pawnDir = attackerColor === 'w' ? 1 : -1; // Pawns attacking this square come from opposite of their move dir
  const attackerPawnRow = row + pawnDir;
  for (const dCol of [-1, 1]) {
    const attackerCol = col + dCol;
    if (isInsideBoard(attackerPawnRow, attackerCol)) {
      const p = board[attackerPawnRow][attackerCol];
      if (p && p.color === attackerColor && p.type === 'p') {
        return true;
      }
    }
  }

  // 2. Check knight attacks
  const knightOffsets = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];
  for (const [dRow, dCol] of knightOffsets) {
    const r = row + dRow;
    const c = col + dCol;
    if (isInsideBoard(r, c)) {
      const p = board[r][c];
      if (p && p.color === attackerColor && p.type === 'n') {
        return true;
      }
    }
  }

  // 3. Check diagonal sliding attacks (Bishop / Queen)
  const diagDirs = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  for (const [dRow, dCol] of diagDirs) {
    let r = row + dRow;
    let c = col + dCol;
    while (isInsideBoard(r, c)) {
      const p = board[r][c];
      if (p) {
        if (p.color === attackerColor && (p.type === 'b' || p.type === 'q')) {
          return true;
        }
        break; // Blocked by any piece
      }
      r += dRow;
      c += dCol;
    }
  }

  // 4. Check orthogonal sliding attacks (Rook / Queen)
  const orthoDirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const [dRow, dCol] of orthoDirs) {
    let r = row + dRow;
    let c = col + dCol;
    while (isInsideBoard(r, c)) {
      const p = board[r][c];
      if (p) {
        if (p.color === attackerColor && (p.type === 'r' || p.type === 'q')) {
          return true;
        }
        break;
      }
      r += dRow;
      c += dCol;
    }
  }

  // 5. Check king attacks (adjacent square)
  const kingOffsets = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];
  for (const [dRow, dCol] of kingOffsets) {
    const r = row + dRow;
    const c = col + dCol;
    if (isInsideBoard(r, c)) {
      const p = board[r][c];
      if (p && p.color === attackerColor && p.type === 'k') {
        return true;
      }
    }
  }

  return false;
}

/**
 * Finds the king position for a given color.
 */
export function findKingPosition(color: PieceColor, board: Board): Position | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color && p.type === 'k') {
        return [r, c];
      }
    }
  }
  return null;
}

/**
 * Checks if the king of the given color is in check.
 */
export function isKingInCheck(color: PieceColor, board: Board): boolean {
  const kingPos = findKingPosition(color, board);
  if (!kingPos) return false;
  const oppColor: PieceColor = color === 'w' ? 'b' : 'w';
  return isSquareAttacked(kingPos, oppColor, board);
}

// =========================================================================
// PSEUDO-LEGAL & STRICT LEGAL MOVES
// =========================================================================

/**
 * Generates all pseudo-legal moves for a piece at `pos`.
 */
export function getPseudoLegalMoves(
  pos: Position,
  board: Board,
  enPassantTarget: Position | null,
  castlingRights: CastlingRights
): Move[] {
  const [row, col] = pos;
  const piece = board[row][col];
  if (!piece) return [];

  switch (piece.type) {
    case 'p':
      return getPawnMoves(pos, piece, board, enPassantTarget);
    case 'n':
      return getKnightMoves(pos, piece, board);
    case 'b':
      return getBishopMoves(pos, piece, board);
    case 'r':
      return getRookMoves(pos, piece, board);
    case 'q':
      return getQueenMoves(pos, piece, board);
    case 'k':
      return getKingMoves(pos, piece, board, castlingRights);
    default:
      return [];
  }
}

/**
 * Simulates a move on a clone board to verify if own king ends up in check.
 */
export function simulateMove(board: Board, move: Move): Board {
  const newBoard = cloneBoard(board);
  const [fromRow, fromCol] = move.from;
  const [toRow, toCol] = move.to;

  const piece = newBoard[fromRow][fromCol];
  if (!piece) return newBoard;

  // Move the piece
  newBoard[toRow][toCol] = move.promotion
    ? { ...piece, type: move.promotion, hasMoved: true }
    : { ...piece, hasMoved: true };
  newBoard[fromRow][fromCol] = null;

  // Handle En Passant
  if (move.isEnPassant) {
    newBoard[fromRow][toCol] = null;
  }

  // Handle Castling Rook placement
  if (move.isCastling === 'kingside') {
    const rook = newBoard[fromRow][7];
    newBoard[fromRow][5] = rook ? { ...rook, hasMoved: true } : null;
    newBoard[fromRow][7] = null;
  } else if (move.isCastling === 'queenside') {
    const rook = newBoard[fromRow][0];
    newBoard[fromRow][3] = rook ? { ...rook, hasMoved: true } : null;
    newBoard[fromRow][0] = null;
  }

  return newBoard;
}

/**
 * Gets all strictly LEGAL moves for the piece at `pos` (filters out pinned / check-violating moves).
 */
export function getLegalMoves(
  pos: Position,
  board: Board,
  enPassantTarget: Position | null,
  castlingRights: CastlingRights
): Move[] {
  const [row, col] = pos;
  const piece = board[row][col];
  if (!piece) return [];

  const pseudoMoves = getPseudoLegalMoves(pos, board, enPassantTarget, castlingRights);

  // Filter out any move that leaves the king in check
  return pseudoMoves.filter((move) => {
    const simulated = simulateMove(board, move);
    return !isKingInCheck(piece.color, simulated);
  });
}

/**
 * Gets all legal moves for all pieces belonging to `color`.
 */
export function getAllLegalMoves(
  color: PieceColor,
  board: Board,
  enPassantTarget: Position | null,
  castlingRights: CastlingRights
): Move[] {
  const moves: Move[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        const pieceMoves = getLegalMoves([r, c], board, enPassantTarget, castlingRights);
        moves.push(...pieceMoves);
      }
    }
  }
  return moves;
}

// =========================================================================
// GAME EXECUTION & STATE UPDATES
// =========================================================================

/**
 * Formats a move in Standard Algebraic Notation (SAN).
 */
export function toAlgebraicNotation(move: Move, boardBefore: Board): string {
  if (move.isCastling === 'kingside') return 'O-O';
  if (move.isCastling === 'queenside') return 'O-O-O';

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const toFile = files[move.to[1]];
  const toRank = 8 - move.to[0];
  const fromFile = files[move.from[1]];

  const piecePrefix = move.piece.type === 'p' ? '' : move.piece.type.toUpperCase();

  if (move.piece.type === 'p') {
    if (move.captured) {
      const promoSuffix = move.promotion ? `=${move.promotion.toUpperCase()}` : '';
      return `${fromFile}x${toFile}${toRank}${promoSuffix}`;
    }
    const promoSuffix = move.promotion ? `=${move.promotion.toUpperCase()}` : '';
    return `${toFile}${toRank}${promoSuffix}`;
  }

  const captureSymbol = move.captured ? 'x' : '';
  return `${piecePrefix}${captureSymbol}${toFile}${toRank}`;
}

/**
 * Executes a move and returns the updated GameState.
 */
export function applyMove(currentState: GameState, move: Move): GameState {
  const [fromRow, fromCol] = move.from;
  const [toRow, toCol] = move.to;
  const piece = currentState.board[fromRow][fromCol];
  if (!piece) return currentState;

  const newBoard = cloneBoard(currentState.board);
  const nextTurn: PieceColor = currentState.turn === 'w' ? 'b' : 'w';

  // Track captured pieces
  const capturedWhite = [...currentState.capturedWhite];
  const capturedBlack = [...currentState.capturedBlack];

  if (move.captured) {
    if (move.captured.color === 'w') {
      capturedWhite.push(move.captured);
    } else {
      capturedBlack.push(move.captured);
    }
  }

  // En Passant capture removal
  if (move.isEnPassant) {
    const victim = newBoard[fromRow][toCol];
    if (victim) {
      if (victim.color === 'w') capturedWhite.push(victim);
      else capturedBlack.push(victim);
      newBoard[fromRow][toCol] = null;
    }
  }

  // Move piece to destination
  newBoard[toRow][toCol] = move.promotion
    ? { ...piece, type: move.promotion, hasMoved: true }
    : { ...piece, hasMoved: true };
  newBoard[fromRow][fromCol] = null;

  // Move castling rook
  if (move.isCastling === 'kingside') {
    const rook = newBoard[fromRow][7];
    newBoard[fromRow][5] = rook ? { ...rook, hasMoved: true } : null;
    newBoard[fromRow][7] = null;
  } else if (move.isCastling === 'queenside') {
    const rook = newBoard[fromRow][0];
    newBoard[fromRow][3] = rook ? { ...rook, hasMoved: true } : null;
    newBoard[fromRow][0] = null;
  }

  // Update Castling Rights
  const newCastlingRights = {
    w: { ...currentState.castlingRights.w },
    b: { ...currentState.castlingRights.b },
  };

  // King moves forfeit all castling rights for that color
  if (piece.type === 'k') {
    newCastlingRights[piece.color] = { kingside: false, queenside: false };
  }

  // Rook moves or captures forfeit that side's castling
  if (piece.type === 'r') {
    if (fromRow === 7 && fromCol === 7) newCastlingRights.w.kingside = false;
    if (fromRow === 7 && fromCol === 0) newCastlingRights.w.queenside = false;
    if (fromRow === 0 && fromCol === 7) newCastlingRights.b.kingside = false;
    if (fromRow === 0 && fromCol === 0) newCastlingRights.b.queenside = false;
  }
  if (toRow === 7 && toCol === 7) newCastlingRights.w.kingside = false;
  if (toRow === 7 && toCol === 0) newCastlingRights.w.queenside = false;
  if (toRow === 0 && toCol === 7) newCastlingRights.b.kingside = false;
  if (toRow === 0 && toCol === 0) newCastlingRights.b.queenside = false;

  // Update En Passant target (only set if pawn moved 2 squares)
  let nextEnPassantTarget: Position | null = null;
  if (piece.type === 'p' && Math.abs(toRow - fromRow) === 2) {
    nextEnPassantTarget = [(fromRow + toRow) / 2, fromCol];
  }

  // Check state for opponent
  const checkOnOpponent = isKingInCheck(nextTurn, newBoard);
  const oppLegalMoves = getAllLegalMoves(nextTurn, newBoard, nextEnPassantTarget, newCastlingRights);

  let isCheckmate = false;
  let isStalemate = false;
  let winner: PieceColor | 'draw' | null = null;

  if (oppLegalMoves.length === 0) {
    if (checkOnOpponent) {
      isCheckmate = true;
      winner = currentState.turn; // Current player wins
    } else {
      isStalemate = true;
      winner = 'draw';
    }
  }

  const san = toAlgebraicNotation(move, currentState.board) + (isCheckmate ? '#' : checkOnOpponent ? '+' : '');

  const completedMove: Move = {
    ...move,
    san,
  };

  return {
    board: newBoard,
    turn: nextTurn,
    selectedPos: null,
    legalMoves: [],
    moveHistory: [...currentState.moveHistory, completedMove],
    capturedWhite,
    capturedBlack,
    enPassantTarget: nextEnPassantTarget,
    castlingRights: newCastlingRights,
    halfMoves: piece.type === 'p' || move.captured ? 0 : currentState.halfMoves + 1,
    fullMoves: currentState.turn === 'b' ? currentState.fullMoves + 1 : currentState.fullMoves,
    isCheck: checkOnOpponent,
    isCheckmate,
    isStalemate,
    winner,
  };
}
