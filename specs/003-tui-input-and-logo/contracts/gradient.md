# Contract: `rainbow45` gradient function

**Feature**: `003-tui-input-and-logo` | **File**: `src/adapters/cli/tui/logo/gradient.ts` (NEW)

Pure, deterministic, side-effect-free. No React/Ink/I/O. Unit-testable in
isolation. Interpolates in **HSL** (hue rotation) so mid-tones stay vivid — RGB
lerp was rejected for producing muddy gray/brown between non-adjacent stops.

---

## Signature

```ts
import type { Theme } from '../theme.js';

/** Fixed rainbow order across Tokyo Night Moon accents (research.md R1). */
export const RAINBOW_STOPS: readonly (keyof Theme)[];

/** Hex color for one cell at (row, col) in a grid sized (rows × cols). */
export function rainbowCellColor(
  row: number,
  col: number,
  rows: number,
  cols: number,
  palette: Theme,
): string;

export interface ColoredCell { char: string; color: string; }

/** Map every cell of a fixed ASCII grid to its gradient color. Computed once. */
export function gradientGrid(
  grid: readonly (readonly string[])[],
  palette: Theme,
): ColoredCell[][];
```

## Projection (the 45° axis) + color

```
t = (col + row) / (maxCol + maxRow)        // ∈ [0, 1]
```

`col + row` projects onto the `x = y` diagonal; the result sweeps bottom-left →
top-right at exactly 45°. Convert each surrounding stop to HSL, **rotate hue**
linearly with `t` between the two surrounding stops, keep S/L near the palette
values, convert back to hex.

## Worked examples (unit-test anchors)

Endpoints are color-space-independent (exact stops), so they pin the test
regardless of RGB-vs-HSL interior:

- Single line (`rows=1, cols=4`):
  - `t(0,0) = 0/3 = 0.000` → stop 0 = `red`   = `#ff757f`
  - `t(0,3) = 3/3 = 1.000` → stop 6 = `purple` = `#c099ff`
- Multi-line (`rows=3, cols=3`):
  - `t(0,0) = 0/4 = 0.000` → `red`
  - `t(2,2) = 4/4 = 1.000` → `purple`
  - interior cells are hue-rotated (not RGB-mixed) — assert they are **saturated**
    (e.g. S ≥ a floor) to guard against the muddy-mid regression.

## Invariants / preconditions

- `rows ≥ 1 && cols ≥ 1` (callers pass compile-time logo constants).
- Output dimensions equal input dimensions.
- Same inputs → same output (deterministic; memoizable; no `Math.random`/`Date`).
- Space chars keep their char; color is positional (a colored space is invisible).

## Non-goals

- No dithered ANSI, no truecolor detection (Ink/Chalk handle downgrade).
- RGB interpolation (rejected — muddy mid-tones on a brand logo).
