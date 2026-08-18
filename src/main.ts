import './style.css';
import { EXAMPLES } from './examples';
import { type Board, type Difficulty, generate, parseBoard, serializeBoard, solve, validateBoard } from './sudoku';

const app = document.querySelector<HTMLElement>('#app')!;
let board = parseBoard(EXAMPLES.Easy);
let fixed = board.map(Boolean);

app.innerHTML = `
  <section class="hero">
    <p class="eyebrow">TECHNICAL INTERVIEW EDITION</p>
    <h1>Sudoku <span>Studio</span></h1>
    <p class="lede">Load, solve, rate, and generate uniquely solvable puzzles.</p>
  </section>
  <section class="workspace">
    <div class="board-panel">
      <div id="grid" class="grid" role="grid" aria-label="Sudoku board"></div>
      <div class="board-actions">
        <button id="solve" class="primary">Solve puzzle</button>
        <button id="validate">Validate</button>
        <button id="clear" class="quiet">Clear</button>
      </div>
    </div>
    <aside class="control-panel">
      <div class="panel-heading">
        <span>Control room</span><span class="status-dot">● READY</span>
      </div>
      <div class="control-block">
        <label for="example">Load an assignment example</label>
        <select id="example">
          ${Object.keys(EXAMPLES).map((name) => `<option>${name}</option>`).join('')}
        </select>
      </div>
      <div class="control-block">
        <label for="file">Import a 9 × 9 text file</label>
        <input id="file" type="file" accept=".txt,text/plain" />
      </div>
      <div class="control-block generator">
        <label for="difficulty">Generate a unique puzzle</label>
        <div class="inline">
          <select id="difficulty">
            <option>Easy</option><option selected>Medium</option><option>Hard</option><option>Samurai</option>
          </select>
          <button id="generate">Generate</button>
        </div>
        <label class="check"><input id="symmetry" type="checkbox" checked /> 180° rotational symmetry</label>
      </div>
      <div id="result" class="result" aria-live="polite">
        <p class="result-title">Puzzle ready</p>
        <p>Choose an action to analyze the board.</p>
      </div>
      <button id="copy" class="wide quiet">Copy puzzle as text</button>
    </aside>
  </section>
  <footer>Built with TypeScript · Solver uses constraint propagation and MRV backtracking</footer>
`;

const grid = document.querySelector<HTMLElement>('#grid')!;
const result = document.querySelector<HTMLElement>('#result')!;

function render(): void {
  grid.innerHTML = '';
  board.forEach((value, index) => {
    const input = document.createElement('input');
    input.className = fixed[index] ? 'cell fixed' : 'cell';
    input.value = value ? String(value) : '';
    input.inputMode = 'numeric';
    input.maxLength = 1;
    input.setAttribute('aria-label', `Row ${Math.floor(index / 9) + 1}, column ${(index % 9) + 1}`);
    input.addEventListener('input', () => {
      const normalized = input.value.replace(/[^1-9]/g, '').slice(-1);
      input.value = normalized;
      board[index] = normalized ? Number(normalized) : 0;
      fixed[index] = false;
      input.classList.remove('fixed', 'invalid');
    });
    grid.append(input);
  });
}

function setBoard(next: Board): void {
  board = [...next];
  fixed = board.map(Boolean);
  render();
}

function show(title: string, message: string, tone: 'ok' | 'warn' = 'ok'): void {
  result.className = `result ${tone}`;
  result.innerHTML = `<p class="result-title">${title}</p><p>${message}</p>`;
}

document.querySelector('#solve')!.addEventListener('click', () => {
  const analysis = solve(board);
  if (analysis.status === 'invalid' || analysis.status === 'unsolvable') {
    show('Cannot solve', analysis.message ?? 'The puzzle has no solution.', 'warn');
    return;
  }
  if (analysis.status === 'multiple') {
    show('Multiple solutions', 'A solution exists, but the puzzle is not uniquely determined.', 'warn');
    return;
  }
  const originalFixed = [...fixed];
  board = analysis.solution!;
  fixed = originalFixed;
  render();
  show(
    `${analysis.difficulty} · score ${analysis.score}`,
    `Unique solution. ${analysis.stats.logicalPlacements} forced moves, ${analysis.stats.guesses} guesses, ${analysis.stats.backtracks} backtracks.`,
  );
});

document.querySelector('#validate')!.addEventListener('click', () => {
  const issue = validateBoard(board);
  if (issue) show('Invalid board', issue, 'warn');
  else show('Valid so far', 'No duplicate values appear in any row, column, or 3 × 3 box.');
});

document.querySelector('#clear')!.addEventListener('click', () => {
  setBoard(Array(81).fill(0));
  show('Board cleared', 'Enter a puzzle or load an example.');
});

document.querySelector<HTMLSelectElement>('#example')!.addEventListener('change', (event) => {
  const name = (event.target as HTMLSelectElement).value as keyof typeof EXAMPLES;
  setBoard(parseBoard(EXAMPLES[name]));
  show(`${name} example loaded`, 'Ready to validate, solve, or edit.');
});

document.querySelector<HTMLInputElement>('#file')!.addEventListener('change', async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    setBoard(parseBoard(await file.text()));
    show('File loaded', `${file.name} is valid and ready.`);
  } catch (error) {
    show('Could not load file', (error as Error).message, 'warn');
  }
});

document.querySelector('#generate')!.addEventListener('click', () => {
  const button = document.querySelector<HTMLButtonElement>('#generate')!;
  const difficulty = document.querySelector<HTMLSelectElement>('#difficulty')!.value as Difficulty;
  const symmetry = document.querySelector<HTMLInputElement>('#symmetry')!.checked;
  button.disabled = true;
  button.textContent = 'Working…';
  window.setTimeout(() => {
    setBoard(generate({ difficulty, symmetry }));
    const analysis = solve(board);
    show(`${difficulty} puzzle generated`, `Unique solution verified · measured ${analysis.difficulty} (score ${analysis.score}).`);
    button.disabled = false;
    button.textContent = 'Generate';
  }, 20);
});

document.querySelector('#copy')!.addEventListener('click', async () => {
  await navigator.clipboard.writeText(serializeBoard(board));
  show('Copied', 'The 9 × 9 puzzle text is on your clipboard.');
});

render();
