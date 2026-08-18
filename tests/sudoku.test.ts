import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../src/examples';
import { generate, parseBoard, serializeBoard, solve, validateBoard } from '../src/sudoku';

describe('text parser', () => {
  it('reads digits and treats every other character as empty', () => {
    const board = parseBoard(EXAMPLES.Easy);
    expect(board).toHaveLength(81);
    expect(board.slice(0, 9)).toEqual([5, 1, 0, 0, 0, 0, 0, 8, 3]);
  });

  it('accepts CRLF and a final newline', () => {
    const source = EXAMPLES.Medium.replace(/\n/g, '\r\n') + '\r\n';
    expect(parseBoard(source)).toHaveLength(81);
  });

  it('rejects the wrong number of rows or columns', () => {
    expect(() => parseBoard('.........\n'.repeat(8))).toThrow('Expected 9 rows');
    expect(() => parseBoard('........\n' + '.........\n'.repeat(8))).toThrow('exactly 9 characters');
  });

  it('round trips through the assignment format', () => {
    expect(serializeBoard(parseBoard(EXAMPLES.Hard))).toBe(EXAMPLES.Hard);
  });
});

describe('validation and solving', () => {
  it('rejects a contradiction in a row', () => {
    const board = Array<number>(81).fill(0);
    board[0] = 4;
    board[1] = 4;
    expect(validateBoard(board)).toMatch(/Duplicate value 4/);
    expect(solve(board).status).toBe('invalid');
  });

  it.each(Object.entries(EXAMPLES))('solves the %s assignment example uniquely', (_, source) => {
    const result = solve(parseBoard(source));
    expect(result.status).toBe('unique');
    expect(result.solution).not.toContain(0);
    expect(result.difficulty).not.toBeNull();
  });

  it('detects a puzzle with more than one solution', () => {
    expect(solve(Array(81).fill(0)).status).toBe('multiple');
  });

  it('detects a valid-looking but unsolvable board', () => {
    const source = `12345678.
........9
.........
.........
.........
.........
.........
.........
.........`;
    expect(solve(parseBoard(source)).status).toBe('unsolvable');
  });
});

describe('generator', () => {
  it('creates a unique puzzle with rotationally symmetric clue placement', () => {
    let state = 123456789;
    const random = () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 2 ** 32;
    };
    const puzzle = generate({ difficulty: 'Easy', symmetry: true, random, maxAttempts: 1 });
    expect(solve(puzzle).status).toBe('unique');
    for (let index = 0; index < 81; index += 1) {
      expect(Boolean(puzzle[index])).toBe(Boolean(puzzle[80 - index]));
    }
  });
});
