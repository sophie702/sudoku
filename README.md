# Sudoku Studio

A TypeScript implementation of the technical interview assignment: import Sudoku puzzles from text, validate and solve them, verify solution uniqueness, estimate difficulty, generate symmetric puzzles, and manage everything through a responsive browser UI.

## Run locally

Requirements: Node.js 22+ and pnpm 10 (enable it with `corepack enable`).

```bash
pnpm install
pnpm dev
```

Open the local URL printed by Vite. For a production build:

```bash
pnpm check
pnpm preview
```

## Features

- Strict 9-row × 9-character text import, including CRLF support
- Any character other than `1`–`9` represents an empty cell
- Row, column, and 3 × 3 box validation with useful error messages
- Constraint-based backtracking solver
- No-solution, unique-solution, and multiple-solution detection
- Explainable difficulty statistics and four rating bands
- Unique puzzle generation with optional 180° rotational symmetry
- Approximate difficulty targeting
- Browser UI for editing, importing, solving, rating, generating, and copying puzzles
- Automated unit tests and GitHub Actions CI
- AWS S3/CloudFront deployment workflow

## Text file format

The file must contain exactly nine lines of nine characters. Digits are clues; any other character is empty.

```text
51.....83
8..416..5
.........
.985.461.
...9.1...
.642.357.
.........
6..157..4
78.....96
```

Use the **Import a 9 × 9 text file** control in the UI. The four assignment examples are also built in.

## Design

The engine in `src/sudoku.ts` has no UI dependencies. A board is a flat array of 81 integers: `0` means empty and `1`–`9` are values. A flat structure makes copying during search inexpensive and converts between index, row, and column with simple arithmetic.

### Solver and uniqueness

For every empty cell, the solver builds a bit mask of legal digits by excluding values already present in its row, column, and box. It then uses the **minimum remaining values** heuristic: explore the cell with the fewest candidates first. Forced cells are therefore handled before guesses, sharply reducing the search tree.

The search does not stop at its first completed board. It continues until it finds either:

1. no solution;
2. exactly one solution after exhausting the tree; or
3. a second solution, at which point it stops because uniqueness has been disproved.

Worst-case backtracking is exponential, but constraint propagation and the minimum-remaining-values heuristic make ordinary 9 × 9 puzzles fast.

### Difficulty model

Sudoku difficulty is subjective: it depends on which human techniques a solver knows. This implementation deliberately exposes a reproducible approximation instead of claiming a universal rating.

The solver records forced placements, branch points, failed branches, and visited search nodes. The score is:

```text
25 × guesses + 12 × backtracks + 2 × max(0, nodes - forced placements)
```

Rating thresholds:

| Score | Rating |
| ---: | --- |
| 0–24 | Easy |
| 25–149 | Medium |
| 150–499 | Hard |
| 500+ | Samurai |

The supplied example labels are reference points, but four examples are not enough to scientifically calibrate a model. A production version would add human-style strategies (hidden singles, pairs, pointing pairs, X-Wing) and calibrate weighted technique scores against a much larger labelled data set.

### Generator

Generation starts with a complete random board produced by shuffled constraint search. It then removes clues in random order. After every removal, the solver verifies that exactly one solution remains; otherwise that clue is restored. The same analysis also measures difficulty after every accepted removal. A removal that overshoots the requested difficulty is restored, while exact matches are retained as candidates.

With symmetry enabled, each position and its 180° partner are removed together. Clue count guides the search but does not define difficulty. The generator returns only a uniquely solvable puzzle whose measured rating exactly matches the requested rating. If it cannot find one within the configured attempt limit, it reports failure instead of returning a mislabeled puzzle. The rating remains a computational approximation of human difficulty.

## Tests

```bash
pnpm test
```

The suite covers parsing, Windows line endings, malformed files, conflicts, all four assignment puzzles, multiple solutions, no solution, unique generation, and symmetric clue placement.

## AWS deployment

The app compiles to static files, so it can be served by S3 and optionally CloudFront. `.github/workflows/deploy-aws.yml` runs tests, builds the app, uploads `dist/`, and invalidates CloudFront when configured.

### 1. Create AWS resources

1. Create a private S3 bucket.
2. Create a CloudFront distribution with the bucket as its origin and Origin Access Control enabled.
3. Set `index.html` as the default root object.
4. Create an IAM role trusted by GitHub's OIDC provider. Restrict the trust policy to this repository and the `main` branch or `production` environment.
5. Grant the role only `s3:ListBucket`, `s3:PutObject`, and `s3:DeleteObject` for this bucket. If using CloudFront, add `cloudfront:CreateInvalidation` for the distribution.

OIDC avoids storing long-lived AWS access keys in GitHub.

### 2. Configure GitHub

In **Settings → Secrets and variables → Actions**, add:

- Secret `AWS_DEPLOY_ROLE_ARN`: IAM role ARN
- Variable `AWS_REGION`: for example `ca-central-1`
- Variable `AWS_S3_BUCKET`: bucket name
- Optional variable `AWS_CLOUDFRONT_DISTRIBUTION_ID`

Create a `production` GitHub environment if deployment approvals are desired. Push to `main` or run **Deploy to AWS** manually from the Actions tab.
