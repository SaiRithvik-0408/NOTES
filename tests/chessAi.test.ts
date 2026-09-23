import { describe, it, expect } from 'vitest';
import { createInitialGameState, applyMove } from '../src/modules/games/chess/chessEngine';
import { Move } from '../src/modules/games/chess/chessTypes';
import { getBestMove, evaluateBoard } from '../src/modules/games/chess/chessAi';

describe('Chess AI Engine & Bot Gameplay Unit Tests', () => {
  it('initializes a standard starting board with equal evaluation', () => {
    const state = createInitialGameState();
    expect(state.turn).toBe('w');
    expect(state.isCheck).toBe(false);
    expect(state.isCheckmate).toBe(false);
    // Board is symmetric at start, evaluation should be 0
    const evalScore = evaluateBoard(state.board);
    expect(evalScore).toBe(0);
  });

  it('computes a valid opening move for White', () => {
    const state = createInitialGameState();
    const move = getBestMove(state, 'medium');
    expect(move).toBeDefined();
    expect(move).not.toBeNull();
    expect(move!.piece.color).toBe('w');
    expect(move!.from).toBeDefined();
    expect(move!.to).toBeDefined();
  });

  it('computes a valid response move for Black after White e2-e4', () => {
    const state = createInitialGameState();
    const e4Move: Move = {
      from: [6, 4],
      to: [4, 4],
      piece: state.board[6][4]!,
    };
    const afterWhiteMove = applyMove(state, e4Move);
    expect(afterWhiteMove.turn).toBe('b');

    const botMove = getBestMove(afterWhiteMove, 'medium');
    expect(botMove).toBeDefined();
    expect(botMove).not.toBeNull();
    expect(botMove!.piece.color).toBe('b');

    const afterBotMove = applyMove(afterWhiteMove, botMove!);
    expect(afterBotMove.turn).toBe('w');
    expect(afterBotMove.moveHistory.length).toBe(2);
  });

  it('calculates moves across easy, medium, and hard difficulties without errors', () => {
    const state = createInitialGameState();
    const easyMove = getBestMove(state, 'easy');
    const medMove = getBestMove(state, 'medium');
    const hardMove = getBestMove(state, 'hard');

    expect(easyMove).not.toBeNull();
    expect(medMove).not.toBeNull();
    expect(hardMove).not.toBeNull();
  });
});
