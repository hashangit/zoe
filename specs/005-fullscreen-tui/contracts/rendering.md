# Contract: Full-Screen Rendering & Layout

**Feature**: `005-fullscreen-tui` | **Layer**: CLI adapter / presentation

UI contract for the full-screen rendering model. No external API.

---

## C1. Root layout (MODIFY `app.tsx`)

The root becomes a **fixed-height column** equal to the viewport:

```
<Box flexDirection="column" height={geometry.rows}>
  <FeedWindow height={geometry.feedHeight} …/>     // top, flexGrow, overflow hidden
  {latestTodos ? <GoalStatus/> : null}              // fixed (counts toward bottomHeight)
  { ── live slot (mutually exclusive): overlay | permission | spinner | null ── }
  <InputArea/>                                      // pinned bottom (PromptArea today; InputBox in 003)
  <Footer/>                                         // pinned bottom
</Box>
```

**Invariants**:
- `height={geometry.rows}` on the root; `overflow="hidden"` so nothing spills.
- `FeedWindow` height = `geometry.feedHeight`; renders only the visible slice
  (see `data-model.md` §3).
- The bottom region (todos + live-slot + InputArea + Footer) is pinned: it is the
  last children of the column, so Ink always paints it at the viewport bottom.
- Empty space on a short session lives **inside** `FeedWindow` (above its content),
  never below the footer (FR-002).

**Removed**: `<Static>`, `staticKey` remount, `resetView`'s static-reset/screen-
clear. `resetView` becomes "recompute geometry + clamp scroll" only.

---

## C2. `FeedWindow` (NEW — replaces `MessageArea`'s `<Static>`)

**File**: `src/adapters/cli/tui/fullscreen/feed-window.tsx`

```ts
interface FeedWindowProps {
  entries: FeedEntry[];           // from useFeed (+ streaming entry appended)
  geometry: ViewportGeometry;
  scroll: ScrollState;            // from useScroll
  expanded: boolean;              // tool-block expand (existing behavior)
}
```

**Behavior**:
- Measures each entry → `MeasuredEntry` (memoized by `(id, width)`); invalidates
  the streaming/growing entry each tick and all entries on width change.
- Computes the visible line window from the bottom: last
  `(feedHeight + offsetFromBottom)` lines.
- Renders those lines top→bottom via the existing per-kind components
  (`UserMessage`, `AssistantMessage`, `ToolCallBlock`, …) — reusing them, not
  reimplementing. A "↓ N new" indicator renders at the top when `!sticky`.
- O(visible) per frame.

**Consumed by**: `app.tsx`.

---

## C3. `AltScreen` edge module (NEW)

**File**: `src/adapters/cli/tui/fullscreen/alt-screen.ts`

```ts
export function enterAltScreen(): void;
export function leaveAltScreen(): void;  // idempotent
```

- `enterAltScreen()` called once before `render()` in `index.tsx` (replacing/augmenting the current `\x1b[2J` clear).
- `leaveAltScreen()` wired to: `onExit`/unmount cleanup, `SIGTERM`, `exit`, and an
  uncaught-error/rejection guard. Idempotent.
- Single owner of `\x1b[?1049h` / `\x1b[?1049l`. No other file emits these.

---

## C4. Measurement (NEW)

**File**: `src/adapters/cli/tui/fullscreen/measure.ts`

```ts
export function measureEntry(entry: FeedEntry, width: number): string[]; // wrapped display lines
```

- Uses `string-width` (display width) + `wrap-ansi` (wrap) — **verify availability**
  in Phase 0; fall back to a ~30-line helper if absent (no new dep).
- Pure, deterministic, unit-testable: known text + width → known line count.
- Memoization lives in `FeedWindow` (keyed `(id, width)`); this fn is the pure
  primitive.

---

## C5. What 003 consumes

After 005, the pinned bottom region contains `PromptArea` + `Footer`. 003 swaps
`PromptArea` → `InputBox` (no layout change) and seeds the logo as the first entry
in `entries` (rendered by `FeedWindow` like any message). **003 introduces zero
layout changes** — it relies entirely on C1's bottom region.

---

## Ownership & boundaries

- `app.tsx`: sole composer; owns geometry + scroll wiring.
- `useScroll` (`fullscreen/use-scroll.ts`): sole scroll owner.
- `FeedWindow` + `measure.ts`: sole feed-windowing/measurement owner.
- `AltScreen`: sole terminal-buffer owner.
- All presentation-layer; imports core types only. Headless paths never import
  `fullscreen/*`.
