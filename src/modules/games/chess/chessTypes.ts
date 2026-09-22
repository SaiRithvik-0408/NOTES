export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'w' | 'b';

export type Position = [number, number]; // [row, col] where row 0 is rank 8 (Black side), row 7 is rank 1 (White side)

export interface Piece {
  id: string;
  type: PieceType;
  color: PieceColor;
  hasMoved?: boolean;
}

export type Board = (Piece | null)[][];

export interface Move {
  from: Position;
  to: Position;
  piece: Piece;
  captured?: Piece | null;
  promotion?: PieceType;
  isCastling?: 'kingside' | 'queenside';
  isEnPassant?: boolean;
  san?: string; // Standard Algebraic Notation e.g. "Nf3", "e4", "O-O"
}

export interface CastlingRights {
  w: { kingside: boolean; queenside: boolean };
  b: { kingside: boolean; queenside: boolean };
}

export interface GameState {
  board: Board;
  turn: PieceColor;
  selectedPos: Position | null;
  legalMoves: Move[];
  moveHistory: Move[];
  capturedWhite: Piece[]; // White pieces captured by Black
  capturedBlack: Piece[]; // Black pieces captured by White
  enPassantTarget: Position | null; // target square behind double-push pawn
  castlingRights: CastlingRights;
  halfMoves: number; // For 50-move rule
  fullMoves: number;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  winner: PieceColor | 'draw' | null;
}

export type GameMode = 'ai' | 'local';
export type AiDifficulty = 'easy' | 'medium' | 'hard';
export type UITheme = '3d-wood' | '2d-classic' | '3d-neon';
