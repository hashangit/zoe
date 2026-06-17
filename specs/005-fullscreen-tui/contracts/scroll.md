# Contract: `useScroll` hook

**Feature**: `005-fullscreen-tui` | **File**: `src/adapters/cli/tui/fullscreen/use-scroll.ts` (NEW)

Single owner of in-app feed scroll. Presentation-layer, no persistence.

---

## Signature

```ts
export interface ScrollState {
  offsetFromBottom: number; // 0 == pinned to newest
  sticky: boolean;          // true == follow new output
}

export function useScroll(opts: {
  totalLines: number;       // current wrapped-line count of the whole feed
  feedHeight: number;       // visible region height (rows)
  /** Bumped (e.g. via a ref counter) whenever new output arrives, so sticky can follow. */
  contentVersion: number;
}): {
  state: ScrollState;
  pageUp: () => void;
  pageDown: () => void;
  lineUp: () => void;   // k
  lineDown: () => void; // j
  /** Keyboard handling; ignored when an overlay/input owns stdin (caller gates). */
  useScrollKeys: (enabled: boolean) => void;
};
```

## Behavior

- `maxOffset = max(0, totalLines - feedHeight)`.
- `pageUp()`: `offset += feedHeight; sticky=false; clamp(offset, 0, maxOffset)`.
- `pageDown()`: `offset -= feedHeight; if offset<=0 {offset=0; sticky=true}`.
- `lineUp()/lineDown()`: same with step 1.
- On `contentVersion` change: if `sticky`, keep `offset=0` (view follows); else
  hold `offset` (clamp to new `maxOffset`).
- On `feedHeight` change (resize): clamp `offset` to new `maxOffset`.
- `useScrollKeys(enabled)`: registers Ink `useInput` for PageUp/PageDown/j/k;
  `enabled=false` when an overlay or the input owns those keys (no double-handling
  — same discipline as 003's overlay-disable).

## Invariants

- `offsetFromBottom ∈ [0, maxOffset]` always.
- `sticky === true` iff `offsetFromBottom === 0` AND the user hasn't scrolled up
  since last reaching the bottom.
- Reaching offset 0 (by PageDown/lineDown) sets `sticky=true`.
- One owner only; `app.tsx` reads `state`, never mutates it directly.

## Non-goals

- Mouse-wheel scroll (best-effort, possibly deferred — see `research.md` R3).
- Horizontal scroll (n/a; wrapping handles width).
