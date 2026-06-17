# Implementation Plan: Full-Screen TUI (Alternate Buffer + In-App Scroll)

**Branch**: `005-fullscreen-tui` (currently on `feature/tui-upgrade-prd`)
| **Date**: 2026-06-15 | **Spec**: [spec.md](./spec.md)

**Input**: `/specs/005-fullscreen-tui/spec.md`. Builds on the shipped
`001-tui-upgrade` Ink TUI. **Unblocks `003-tui-input-and-logo`** (its
"pinned to the bottom" requirement needs this model).

## Summary

Convert the TUI from the `<Static>`-into-native-scrollback model to a **full-screen
alternate-buffer app**: the feed becomes a **windowed, in-app-scrollable** region,
and the input area + footer are **pinned to the viewport bottom** (Claude Code /
Codex look) on every frame, short or long sessions. Page Up/Down + j/k scroll;
new output auto-sticks to the bottom. Resize reflows; exit/crash restores the
terminal. Native terminal scrollback is traded away (accepted).

This is a **rendering-model rewrite** of the presentation layer — `<Static>`,
`ink-reset.ts`, and the `staticKey`/`resetView` remount machinery are removed and
replaced with a fixed-height column layout, a windowed `FeedWindow`, a `useScroll`
hook, a measurement module, and an `AltScreen` edge module. The agent engine,
feed data, providers, tools, and non-interactive paths are untouched.

## Technical Context

**Language/Version**: TypeScript (ES2024 / NodeNext, `strict`, `jsx: react-jsx`).
No bundler — `tsc`.

**Primary Dependencies**: `ink@6.6.0`, `react@^19.1.7` (present). Reuses
transitive `string-width` + `wrap-ansi` for measurement (verify; small helper
fallback, no new dep). **No new dependency** for alt-buffer (two escape codes).

**Storage**: N/A — pure rendering model.

**Testing**: Vitest. `measureEntry` (wrapping) and `useScroll` (clamp/sticky) get
unit tests. Manual TTY scenarios in `quickstart.md` (S1–S8). Full suite green.

**Target Platform**: Any modern TTY. Non-interactive paths never enter the alt
buffer or import `fullscreen/*`.

**Performance Goals**: O(visible) repaint per frame via windowing + memoized
`(id, width)` measurement; smooth streaming; no flicker in the alt buffer.

**Constraints**:
- **Lazy-load invariant** — `fullscreen/*` loads only in interactive mode; headless
  never imports it.
- **One scroll owner** — `useScroll`; no second copy of offset (CLAUDE.md).
- **One terminal-buffer owner** — `AltScreen`; no scattered `\x1b[?1049…`.
- **Effects at the edges** — escape codes + signal handlers live in `AltScreen`,
  not in components or domain code.
- **Exit safety** — leave-alt-buffer wired to unmount, SIGTERM, exit, and uncaught
  errors; idempotent.
- **No bundler; `pnpm` only.**

**Scale/Scope**: new `fullscreen/` subpackage (`alt-screen.ts`, `layout.ts`,
`measure.ts`, `feed-window.tsx`, `use-scroll.ts`) + unit tests; rewrite
`message-area.tsx` (→ `FeedWindow`) and rework `app.tsx` (fixed-height column,
scroll wiring, pinned bottom); remove `ink-reset.ts`; slim `index.tsx`
(`resetView`/warm). ~6 new + 3 modified + 1 removed. Each file under the 400-line
budget (the rewrite is cohesive, not a god-file).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Single Execution Engine & Layered Boundaries | ✅ Compliant | Presentation-only under `src/adapters/cli/tui/`. Agent engine, feed data (`useFeed`), providers, tools untouched. Streaming still flows through the same `useAgent` bridge. |
| II. Single Source of Truth | ✅ Compliant | One scroll owner (`useScroll`); one geometry owner (`layout.ts`); one terminal-buffer owner (`AltScreen`); one measurement primitive (`measure.ts`). `app.tsx` composes; it does not duplicate state. |
| III. Simplicity First | ✅ Compliant (with justified complexity) | No new dependency (reuse transitive `string-width`/`wrap-ansi`, else a ~30-line helper). Windowing is the minimum needed to make a live feed fit a fixed viewport at O(visible). Complexity is inherent to the user's explicit requirement (bottom-pinning), not gold-plating. |
| IV. Surgical Changes | ⚠️ Scoped rewrite | This intentionally rewrites the rendering layer (`message-area.tsx`, `app.tsx`, removes `ink-reset.ts`) — that is the feature. Headless/SDK/Server/`repl.ts`/engine untouched. Per-kind message components are **reused** by `FeedWindow`, not rewritten. |
| V. Safe by Default & Verifiable | ✅ Compliant | Phase 0 smoke tests (alt-buffer render; measure deps) gate the rewrite. `quickstart.md` S1–S8 are explicit Verify gates incl. exit/crash terminal restore (S6). `measure`/`scroll` unit-tested. Non-interactive parity (S7). |

*Post-Phase-1 re-check*: compliant. The one scope-rewrite (Principle IV) is the
feature itself, documented in Complexity Tracking — not an accidental sprawl.

## Project Structure

```text
specs/005-fullscreen-tui/
├── plan.md              # This file
├── spec.md              # US1 (full-screen + pin) + US2 (scroll)
├── research.md          # alt-buffer, windowing, scroll, exit safety, 003 boundary
├── data-model.md        # ViewportGeometry / ScrollState / MeasuredEntry / AltScreen
├── contracts/
│   ├── rendering.md      # layout, FeedWindow, AltScreen, measure, 003 seam
│   └── scroll.md         # useScroll hook
└── quickstart.md        # S1–S8 (+ Phase 0 smoke tests)
# tasks.md generated next by /speckit.tasks

src/adapters/cli/tui/
├── app.tsx              # REWRITE root → fixed-height column; scroll wiring; pinned bottom
├── index.tsx            # MODIFY — enterAltScreen before render; resetView → recompute-only; wire leave on exit
├── ink-reset.ts         # REMOVE (orphaned by <Static> removal)
├── components/
│   └── message-area.tsx # REPLACE <Static> with FeedWindow (or delete in favor of fullscreen/feed-window.tsx)
└── fullscreen/          # NEW subpackage
    ├── alt-screen.ts    # enter/leave alt buffer (idempotent; one owner)
    ├── layout.ts        # computeGeometry(rows, cols, bottomHeight)
    ├── measure.ts       # measureEntry(entry, width) → wrapped lines (pure)
    ├── feed-window.tsx  # windowed feed: visible slice + "↓ N new" indicator
    └── use-scroll.ts    # ScrollState + pageUp/Down + j/k + sticky

src/adapters/cli/tui/fullscreen/*.test.ts   # NEW — measure + useScroll unit tests
```

**Structure Decision**: Single-project layout. A new cohesive `fullscreen/`
subpackage owns the rendering model (one concept = one owner dir, CLAUDE.md).
`app.tsx`/`index.tsx` reworked; `message-area.tsx` replaced by `FeedWindow`;
`ink-reset.ts` removed (orphaned). Nothing crosses into core/infra/engine or other
adapters.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|-----------|--------------------------------------|
| Rendering-layer rewrite (Principle IV scope) | The user explicitly requires viewport-bottom pinning, which is impossible under `<Static>`-into-scrollback. Full-screen alt-buffer + windowed feed is the minimum viable model. | Keeping `<Static>` (can't bottom-pin); padding-newlines hack (breaks streaming/resize); a virtualization dep (windowing is ~80 lines). |
| New `fullscreen/` subpackage (5 files) | The model has 5 distinct concerns (buffer, layout, measure, window, scroll) that change together but are individually cohesive — splitting prevents a god-file. | One big `fullscreen.ts` (would cross the 400-line budget and mix concerns). |

## Done When

- [ ] `research.md`, `data-model.md`, `contracts/`, `quickstart.md` generated ✅
- [ ] 003 updated to declare its dependency on 005 ✅
- [ ] Agent context (`CLAUDE.md`) points at 005 as current ✅
- [ ] Completion reported

Next: `/speckit-tasks` → `tasks.md` → implement **005 before 003**.
