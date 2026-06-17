# Data Model: Full-Screen TUI

**Feature**: `005-fullscreen-tui` | **Date**: 2026-06-15

**Persistence**: **None.** Pure rendering model. No schema, no migration. This
records the **in-memory shapes** the new pieces introduce, so contracts and tasks
have precise types.

---

## 1. Viewport geometry (computed each frame / on resize)

```ts
// src/adapters/cli/tui/fullscreen/layout.ts
export interface ViewportGeometry {
  rows: number;        // stdout.rows
  cols: number;        // stdout.columns
  feedHeight: number;  // rows - bottomHeight (>= MIN_FEED_HEIGHT)
  bottomHeight: number; // input(+)spinner + footer (+todos) rows
}
export function computeGeometry(rows: number, cols: number, bottomHeight: number): ViewportGeometry;
```

**Invariant**: `feedHeight >= MIN_FEED_HEIGHT` (e.g. 1). If the terminal is too
small, clamp `feedHeight` to the minimum and let the bottom region clip — never
negative.

## 2. Scroll state (one owner: `useScroll`)

```ts
// src/adapters/cli/tui/fullscreen/use-scroll.ts
export interface ScrollState {
  offsetFromBottom: number; // 0 == sticky to newest; >=0 lines scrolled up
  sticky: boolean;          // true ⇒ follow new output
}
```

**State transitions**:
- New output arrives, `sticky === true` ⇒ `offsetFromBottom` stays 0.
- New output arrives, `sticky === false` ⇒ state unchanged; "↓ N new" shown.
- User PageUp/k (up) ⇒ `offsetFromBottom += n`; `sticky = false`.
- User PageDown/j (down) ⇒ `offsetFromBottom -= n`; if reaches 0 ⇒ `sticky = true`.
- Resize ⇒ re-clamp `offsetFromBottom` to `[0, max(0, totalLines - feedHeight)]`.

## 3. Measured feed entries (windowing)

```ts
export interface MeasuredEntry { id: string; lines: string[]; } // wrapped display lines
```

A `Map<id, MeasuredEntry>` (or memo) keyed by `(id, width)`. The full feed's line
list = concatenation of entries' `lines` in order. The visible window = the last
`(feedHeight + offsetFromBottom)` lines, rendered top→bottom, clamped. Invalidate
an entry only when its content changes (streaming/tool output) or width changes.

## 4. Edge module: alternate screen

```ts
// src/adapters/cli/tui/fullscreen/alt-screen.ts
export function enterAltScreen(): void;  // '\x1b[?1049h' (+ clear)
export function leaveAltScreen(): void;  // '\x1b[?1049l' (idempotent)
```

**One owner** of the escape codes. No scattered `\x1b[?1049…` elsewhere.

---

## Validation rules

- Exactly **one** scroll owner (`useScroll`); `app.tsx` reads, never duplicates.
- `offsetFromBottom` is always within `[0, max(0, totalLines - feedHeight)]`.
- `feedHeight` is always `>= MIN_FEED_HEIGHT`.
- `leaveAltScreen` is safe to call repeatedly (idempotent) and is wired to every
  exit path (unmount, SIGTERM, exit, uncaught error).
- Width measurement uses `string-width`; wrapping uses `wrap-ansi` (verify) — no
  hand-rolled width math that disagrees with the rest of the TUI.
