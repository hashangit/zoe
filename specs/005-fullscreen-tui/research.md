# Research: Full-Screen TUI (Alternate Buffer + In-App Scroll)

**Feature**: `005-fullscreen-tui` | **Date**: 2026-06-15

Resolves every NEEDS CLARIFICATION. Decision / Rationale / Alternatives for each.

---

## R1. Ink + the alternate screen buffer

**Decision**: Hand-manage the alternate buffer. Enter on TUI mount
(`process.stdout.write('\x1b[?1049h')`), leave on unmount/exit
(`'\x1b[?1049l'`). Ink does NOT provide a first-party fullscreen helper, but it
writes to `stdout` and manages the cursor itself; the alt buffer is transparent
to cursor movement, so Ink's erase-and-redraw-of-the-live-region works unchanged
inside it.

**Rationale**: minimal — two escape codes around `render()`/`unmount()`. No new
dependency. The one-shot `\x1b[2J` clear the TUI already does at launch
(`index.tsx:165`) stays; we add the buffer switch around it.

**Alternatives**:
- `ink-fullscreen` / similar community package — rejected: adds a dependency for
  two escape codes (CLAUDE.md §6); and most just toggle the same buffer.
- Keep the normal buffer and try to bottom-pin with padding newlines — rejected:
  breaks streaming, creates scrollback gaps, doesn't survive resize.

---

## R2. Replacing `<Static>` with a windowed live region

**Finding**: `message-area.tsx` renders `<Static items={entries}>`, which writes
each entry once into the terminal's native scrollback. This is fundamentally
incompatible with bottom-pinning: `<Static>` output is immutable and lives "above"
the live region, which therefore can't be viewport-bottom-pinned.

**Decision**: Remove `<Static>`. Render the feed as a **regular `<Box>`** with a
fixed `height={feedHeight}` and `overflow="hidden"`, containing only the visible
slice of the (wrapped) feed. Ink then treats the whole tree as live and repaints
it within the viewport each frame; because the tree is windowed to `feedHeight`,
it always fits.

**Measurement subsystem** (the main complexity):
- For each feed entry, compute its wrapped display-lines at the current column
  width → `MeasuredEntry { id, lines: string[] }`.
- The full feed is the concatenation of all entries' lines; the window is the
  last `(feedHeight + offsetFromBottom)` lines rendered top→bottom (clamped).
- **Memoize** per `(entry.id, width)`; invalidate only the streaming/growing
  entry each tick and everything on width change. This keeps re-render O(visible).
- Use `string-width` for display width and `wrap-ansi` for wrapping — both are
  transitive deps of `ink`/`chalk`. **Verify availability** (Phase 0 smoke test);
  if absent, write a ~30-line wrap helper (no new dep).

**Rationale**: `<Static>` is the blocker; removing it is required. Windowing keeps
the live tree small enough that Ink's full-repaint is cheap even for long feeds.

**Alternatives**:
- Keep `<Static>` and add a second live region — rejected: can't bottom-pin.
- Render the entire feed live without windowing — rejected: O(total) repaint each
  frame; unusable on long sessions.
- A virtualized list library — rejected: adds a dep for bounded, memoized slicing
  we can do in ~80 lines.

---

## R3. Scroll model

**Decision**: One `useScroll` hook owns `ScrollState { offsetFromBottom, sticky }`.
- `offsetFromBottom = 0` ⇒ stuck to the newest content (sticky-bottom).
- Page Up/Down ⇒ ±`feedHeight`; `j`/`k` ⇒ ±1. Clamp to
  `[0, max(0, totalLines - feedHeight)]`.
- Any user scroll-up sets `sticky = false`; reaching the bottom sets it `true`.
- While `sticky`, new output keeps `offsetFromBottom = 0` (view follows). While
  not sticky, the view holds; an indicator ("↓ N new") shows newer content below.
- Resize: recompute `feedHeight`, re-clamp `offsetFromBottom`.

**Rationale**: `offsetFromBottom` (not "top offset") makes sticky-bottom the
natural zero state and new-output-following trivial. One owner (the hook) — no
second copy of scroll state (CLAUDE.md).

**Alternatives**:
- Scroll-by-entry (not by-line) — rejected: entries vary wildly in height; line
  scroll is smoother and simpler to clamp.
- Mouse-wheel as primary — rejected: Ink 6 mouse support is limited/unreliable;
  keyboard is the guaranteed baseline. Mouse wheel is **best-effort**: if Ink
  exposes wheel events cleanly, map them to ±N lines; otherwise defer (noted, not
  silently dropped).

---

## R4. Terminal-restore safety

**Decision**: A single `AltScreen` module owns enter/leave. Leave is wired to:
- React `useEffect` cleanup on unmount (covers `/exit`, idle Ctrl+C → `onExit` →
  `instance.unmount()`).
- `process.on('SIGTERM')` and `process.on('exit')`.
- A top-level guard for uncaught errors/`unhandledRejection` that writes the leave
  code before the process dies.

Raw mode is Ink-managed; on unmount Ink restores it. The `AltScreen` leave is
idempotent (safe to call multiple times across paths).

**Rationale**: a half-restored terminal (stuck in alt buffer, raw mode on) is the
worst-case UX regression for this feature. One owner, all exit paths.

**Alternatives**: rely only on Ink unmount — rejected: misses SIGTERM/crashes.

---

## R5. Impact on existing TUI machinery

**Finding / decision**:
- `ink-reset.ts` (`warmInkReset`, `resetInkStatic`) and the `staticKey` remount +
  `resetView` pattern exist **only** to manage `<Static>` repaints. With `<Static>`
  gone, they are **removed**; `resetView` becomes a plain "recompute layout"
  (heights/scroll), no screen clear or static reset.
- `app.tsx`: the root becomes a fixed-height column (`height={rows}`); the current
  padding-only `<Box flexDirection="column">` gains explicit region heights and
  `overflow="hidden"` on the feed. The mutually-exclusive live slot (overlays,
  permission, spinner) and the `Footer` move into the **pinned bottom region**.
- Streaming (`streamingText`/`streamingTool`) renders as the latest entry/lines in
  the windowed feed; the existing `useAgent` bridge is unchanged.
- 003's `InputBox`/`LogoBanner` drop in unchanged: the input sits in the pinned
  bottom region; the logo is the first windowed feed entry.

**Rationale**: surgical to the rendering layer; the agent/feed-data layer is
untouched. The removed code is orphaned by this change (CLAUDE.md: clean up your
own mess).

---

## R6. Boundary with 003

**Decision**: 005 owns the rendering model ONLY. After 005, the bottom region
exists and is pinned (containing the current borderless `PromptArea` + footer) and
the feed is windowed. 003 then (a) swaps `PromptArea` → bordered `InputBox` in the
pinned bottom region, and (b) seeds the logo as the first windowed feed entry. 003
introduces **no** layout changes — it consumes 005's region contract. Build order:
**005 → 003**.

---

## Open items after research

- **Verify** `string-width` / `wrap-ansi` availability (transitive via Ink/Chalk)
  in the Phase 0 smoke test; fall back to a small helper if absent.
- **Verify** Ink repaints correctly inside the alt buffer with a minimal smoke
  render before the full rewrite.
- **Decide** (implementer, low-stakes) whether Ink 6 wheel events are reliable
  enough to ship mouse scroll, or defer to keyboard-only for v1.
