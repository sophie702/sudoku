export type Cell = number;
export type Board = Cell[];
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Samurai';

export interface SolveStats {
  logicalPlacements: number;
  guesses: number;
  backtracks: number;
  nodes: number;
}

export interface SolveResult {
  status: 'invalid' | 'unsolvable' | 'unique' | 'multiple';
  solution: Board | null;
  solutionCount: number;
  stats: SolveStats;
  difficulty: Difficulty | null;
  score: number | null;
  message?: string;
}

export const SIZE = 9;
export const CELL_COUNT = 81;
const ALL_DIGITS_MASK = 0b1111111110;

export function parseBoard(text: string): Board {
  const lines = text.replace(/\r/g, '').split('\n');
  if (lines.at(-1) === '') lines.pop();
  if (lines.length !== SIZE) {
    throw new Error(`Expected 9 rows, received ${lines.length}.`);
  }

  const board: Board = [];
  lines.forEach((line, row) => {
    if ([...line].length !== SIZE) {
      throw new Error(`Row ${row + 1} must contain exactly 9 characters.`);
    }
    for (const character of line) {
      board.push(/^[1-9]$/.test(character) ? Number(character) : 0);
    }
  });

  const issue = validateBoard(board);
  if (issue) throw new Error(issue);
  return board;
}

export function serializeBoard(board: Board, empty = '.'): string {
  assertBoardShape(board);
  return Array.from({ length: SIZE }, (_, row) =>
    board.slice(row * SIZE, row * SIZE + SIZE).map((value) => value || empty).join(''),
  ).join('\n');
}

export function validateBoard(board: Board): string | null {
  if (board.length !== CELL_COUNT) return 'A board must contain exactly 81 cells.';
  if (board.some((value) => !Number.isInteger(value) || value < 0 || value > 9)) {
    return 'Every cell must be an integer from 0 to 9.';
  }

  for (let index = 0; index < CELL_COUNT; index += 1) {
    const value = board[index]!;
    if (value === 0) continue;
    const copy = [...board];
    copy[index] = 0;
    if ((candidateMask(copy, index) & (1 << value)) === 0) {
      const row = Math.floor(index / SIZE) + 1;
      const column = (index % SIZE) + 1;
      return `Duplicate value ${value} conflicts at row ${row}, column ${column}.`;
    }
  }
  return null;
}

export function candidates(board: Board, index: number): number[] {
  const mask = candidateMask(board, index);
  const values: number[] = [];
  for (let value = 1; value <= 9; value += 1) {
    if (mask & (1 << value)) values.push(value);
  }
  return values;
}

function candidateMask(board: Board, index: number): number {
  if (board[index] !== 0) return 0;
  const row = Math.floor(index / SIZE);
  const column = index % SIZE;
  let used = 0;

  for (let offset = 0; offset < SIZE; offset += 1) {
    used |= 1 << board[row * SIZE + offset]!;
    used |= 1 << board[offset * SIZE + column]!;
  }

  const boxRow = Math.floor(row / 3) * 3;
  const boxColumn = Math.floor(column / 3) * 3;
  for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < 3; columnOffset += 1) {
      used |= 1 << board[(boxRow + rowOffset) * SIZE + boxColumn + columnOffset]!;
    }
  }
  return ALL_DIGITS_MASK & ~used;
}

export function solve(board: Board): SolveResult {
  const issue = validateBoard(board);
  const stats: SolveStats = { logicalPlacements: 0, guesses: 0, backtracks: 0, nodes: 0 };
  if (issue) {
    return { status: 'invalid', solution: null, solutionCount: 0, stats, difficulty: null, score: null, message: issue };
  }

  let firstSolution: Board | null = null;
  let solutionCount = 0;

  const search = (current: Board, depth: number): void => {
    if (solutionCount >= 2) return;
    stats.nodes += 1;

    let bestIndex = -1;
    let bestCandidates: number[] = [];
    for (let index = 0; index < CELL_COUNT; index += 1) {
      if (current[index] !== 0) continue;
      const available = candidates(current, index);
      if (available.length === 0) {
        stats.backtracks += 1;
        return;
      }
      if (bestIndex === -1 || available.length < bestCandidates.length) {
        bestIndex = index;
        bestCandidates = available;
        if (available.length === 1) break;
      }
    }

    if (bestIndex === -1) {
      solutionCount += 1;
      if (!firstSolution) firstSolution = [...current];
      return;
    }

    if (bestCandidates.length === 1) stats.logicalPlacements += 1;
    else stats.guesses += 1;

    for (const value of bestCandidates) {
      const next = [...current];
      next[bestIndex] = value;
      const before = solutionCount;
      search(next, depth + 1);
      if (solutionCount === before && bestCandidates.length > 1) stats.backtracks += 1;
      if (solutionCount >= 2) return;
    }
  };

  search([...board], 0);
  if (solutionCount === 0) {
    return { status: 'unsolvable', solution: null, solutionCount, stats, difficulty: null, score: null };
  }

  const score = rateDifficulty(stats);
  return {
    status: solutionCount === 1 ? 'unique' : 'multiple',
    solution: firstSolution,
    solutionCount,
    stats,
    difficulty: difficultyFromScore(score),
    score,
  };
}

export function rateDifficulty(stats: SolveStats): number {
  return stats.guesses * 25 + stats.backtracks * 12 + Math.max(0, stats.nodes - stats.logicalPlacements) * 2;
}

export function difficultyFromScore(score: number): Difficulty {
  if (score < 25) return 'Easy';
  if (score < 150) return 'Medium';
  if (score < 500) return 'Hard';
  return 'Samurai';
}

export interface GenerateOptions {
  difficulty?: Difficulty;
  symmetry?: boolean;
  random?: () => number;
  maxAttempts?: number;
}

const CLUE_TARGETS: Record<Difficulty, number> = {
  Easy: 40,
  Medium: 34,
  Hard: 29,
  Samurai: 25,
};

export function generate(options: GenerateOptions = {}): Board {
  const difficulty = options.difficulty ?? 'Medium';
  const random = options.random ?? Math.random;
  const symmetry = options.symmetry ?? true;
  const target = CLUE_TARGETS[difficulty];
  const maxAttempts = options.maxAttempts ?? 4;
  let best: Board | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const completed = createCompletedBoard(random);
    const puzzle = [...completed];
    const positions = shuffle(Array.from({ length: symmetry ? 41 : 81 }, (_, index) => index), random);

    for (const position of positions) {
      if (puzzle.filter(Boolean).length <= target) break;
      const pair = symmetry ? CELL_COUNT - 1 - position : position;
      const previous = puzzle[position]!;
      const previousPair = puzzle[pair]!;
      puzzle[position] = 0;
      puzzle[pair] = 0;
      if (puzzle.filter(Boolean).length < target || solve(puzzle).status !== 'unique') {
        puzzle[position] = previous;
        puzzle[pair] = previousPair;
      }
    }

    best = puzzle;
    const rating = solve(puzzle).difficulty;
    if (rating === difficulty) return puzzle;
  }
  return best!;
}

function createCompletedBoard(random: () => number): Board {
  const board = Array<number>(CELL_COUNT).fill(0);
  const fill = (): boolean => {
    let bestIndex = -1;
    let best: number[] = [];
    for (let index = 0; index < CELL_COUNT; index += 1) {
      if (board[index] !== 0) continue;
      const available = candidates(board, index);
      if (available.length === 0) return false;
      if (bestIndex === -1 || available.length < best.length) {
        bestIndex = index;
        best = available;
      }
    }
    if (bestIndex === -1) return true;
    for (const value of shuffle(best, random)) {
      board[bestIndex] = value;
      if (fill()) return true;
    }
    board[bestIndex] = 0;
    return false;
  };
  fill();
  return board;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other]!, copy[index]!];
  }
  return copy;
}

function assertBoardShape(board: Board): void {
  if (board.length !== CELL_COUNT) throw new Error('A board must contain exactly 81 cells.');
}
