# Tasks: Inline Diff Viewer + Safe Write (T051)

**Input**: Design documents from `specs/006-inline-diff-viewer/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/tool-result-metadata.md ✅, quickstart.md ✅
**Tests**: Included — constitution §V requires verifiable gates; quickstart.md defines failing-test-first scenarios for each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1 = safe write, US2 = diff viewer)
- Exact file paths are included in every description

## Path Conventions

Single project: `src/` at repository root, tests under `src/**/__tests__/` (Vitest glob). TUI under `src/adapters/cli/tui/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the one new dependency before any code that imports it.

- [X] T001 Add the `diff` package (`pnpm add diff`) and verify it imports under `tsx`; record the version in `package.json`. Confirm `diff@8`, BSD-3-Clause, zero transitive deps (see research.md R1).

**Checkpoint**: `diff` importable; no source changes yet.

---

## Phase 2: Foundational (Blocking Prerequisites — the metadata channel)

**Purpose**: Thread tool-result metadata from handler → `executeTool` → `agent-loop` → `StepResult`. MUST be complete before US1 or US2.

**⚠️ CRITICAL**: US1 (write handler emits metadata) and US2 (TUI reads metadata) both depend on this channel.

- [X] T002 [P] Add optional top-level `metadata?: Record<string, unknown>` field to the `StepResult` interface in `src/core/types.ts` (after the existing `toolCall?` block; do not nest under `toolCall`).
- [X] T003 [P] Widen `ToolModule.handler`'s return type in `src/tools/interface.ts` from `Promise<string>` to `Promise<string | ToolResult>` (type-only import of `ToolResult` from `../core/types.js`).
- [X] T004 Change `executeTool` in `src/core/tool-executor.ts` to return `Promise<ToolResult>` instead of `Promise<string>`: normalize a bare-string handler return to `{ output, success: true }`, pass a `ToolResult` return through **with `metadata` preserved**, and fix the `tool()` factory handler (currently `tool-executor.ts:146-149`) to return the full `ToolResult` (including `metadata`) instead of discarding it.
- [X] T005 Update the three tool-execution statements in `src/core/agent-loop.ts` (~lines 413, 426, 443). Each is a ternary with an **injected-module branch** (`injectedModule.handler(...)`) **and** an `executeTool(...)` branch (see ARCHITECTURE.md §Agent-Loop Bridge) — both now return `string | ToolResult`, so normalize both into `{ output, metadata }`, keep `output` flowing to the `role: 'tool'` message and `toolCall.result`, and set `metadata` on the `tool_call` `StepResult` (undefined when absent).
- [X] T006 Verify the channel compiles and is backward compatible: `pnpm build` is clean and `pnpm test` stays green (the existing Vitest suite; every non-write tool still renders unchanged — no metadata → plain rendering).

**Checkpoint**: Metadata channel live end-to-end; no tool yet emits metadata. Existing behavior unchanged.

---

## Phase 3: User Story 1 — Safe Atomic Write (Priority: P1) 🎯 MVP

**Goal**: `write_file` becomes crash-safe (atomic temp + rename) and captures old content as metadata — delivering corruption protection with no UI changes required.

**Independent test criteria** (quickstart.md Scenarios 1, 2, 3):
- New file → created, atomic, `metadata.isNewFile === true`, no `.tmp` left behind.
- Edit → old content captured in `metadata.oldContent`, `output` shows `N -> M lines`.
- Rename failure (stubbed) → original file untouched, temp cleaned, error `output`.

- [X] T007 [US1] Define and `export interface FileWriteMetadata` in `src/tools/core.ts` (producer owns the type — single source of truth): `{ path: string; oldContent: string | null; newContent: string; isNewFile: boolean; byteDelta: number; diffSkipped?: boolean; skipReason?: string }`. (Layering note: the TUI imports this as a type-only import — Adapters may depend on Infrastructure; the parse guard lives TUI-side in US2.)
- [X] T008 [US1] Rewrite the `WriteFileTool.handler` in `src/tools/core.ts` (currently the blind overwrite at `core.ts:100-108`): best-effort `fs.readFile` old content (absent ⇒ `isNewFile`), `mkdir -p` the dir, write to a same-dir temp `${path}.${randomUUID().slice(0,8)}.tmp`, `fs.rename` atomically, and on any failure after temp creation `fs.unlink` the temp + return an error `output` (original never partial). Return a `ToolResult { output: "Successfully wrote to <path> (N -> M lines)", success: true, metadata: <FileWriteMetadata> }`. Apply the size cap: new content > 64 KB or > 2000 lines ⇒ set `diffSkipped: true` + `skipReason`.
- [X] T009 [US1] Write `src/tools/__tests__/write-file.test.ts` (Vitest): (a) new-file write creates the file and metadata reports `isNewFile === true`; (b) overwrite of a seeded file reports `oldContent` + `newContent` and the on-disk result; (c) atomic crash-safety — stub `fs.rename` to throw, assert the original file content is unchanged, no temp remains, and the handler returns an error `output`.

**Checkpoint**: `write_file` is crash-safe and emits `FileWriteMetadata`. MVP shippable (no UI).

---

## Phase 4: User Story 2 — Inline Diff Viewer (Priority: P1, depends on US1)

**Goal**: The `write_file` tool-call block renders a unified diff (green added / red removed / dim context), collapsed by default, skipping oversized files.

**Independent test criteria** (quickstart.md Scenarios 1, 2, 4, 5, 7):
- New file → all-green diff; identical rewrite → "no changes".
- Edit → mixed red/green; metadata never echoed by the assistant (isolation).
- Oversized file → plain "file written" note (no dump).
- CRLF file → only the changed line diffs.
- Collapse shows first hunk + `... N more`; expand shows full diff.

- [X] T010 [P] [US2] Create `src/adapters/cli/tui/diff/file-write-meta.ts`: export `isFileWriteMetadata(u: unknown): u is FileWriteMetadata` — a parse guard (type-only import of `FileWriteMetadata` from `../../../tools/core.js`) that validates the opaque `metadata` bag at the boundary (constitution: parse, don't cast).
- [X] T011 [P] [US2] Create `src/adapters/cli/tui/diff/line-diff.ts`: export `DiffViewLine` (union: `added`/`removed`/`context` with old/new line numbers) and `computeDiffLines(oldContent: string | null, newContent: string): DiffViewLine[]` using `Diff.diffLines` from the `diff` package, normalizing `\r\n` → `\n` on both sides before comparison (research.md R5). Null old content ⇒ all-added.
- [X] T012 [P] [US2] Add `metadata?: unknown` to the `ToolCallEntry` variant in `src/adapters/cli/tui/types.ts`, and copy `step.metadata` onto it in `src/adapters/cli/tui/hooks/use-agent.ts` where tool entries are built from steps.
- [X] T013 [US2] Create `src/adapters/cli/tui/components/diff-viewer.tsx`: render `DiffViewLine[]` — green `+` added, red `-` removed, dim ` ` context with padded line numbers; Pi-style context-collapse (≈3–4 context lines per hunk, `... N skipped` elision) and a collapsed-by-default view with a `... N more` expand affordance (research.md R4). When `diffSkipped` is true, render a plain "file written (N lines)" note instead.
- [X] T014 [US2] Wire `src/adapters/cli/tui/components/tool-call-block.tsx`: when `entry.name === 'write_file'` and `isFileWriteMetadata(entry.metadata)` and `!metadata.diffSkipped`, render `<DiffViewer oldContent={metadata.oldContent} newContent={metadata.newContent} />` in place of the raw output; otherwise render exactly as today.
- [X] T015 [US2] Write `src/adapters/cli/tui/__tests__/diff-viewer.test.ts` with `ink-testing-library`: new-file all-green, edit mixed added/removed, oversized-file skip note, and collapse→expand shows the full diff.

**Checkpoint**: `write_file` changes render as a reviewable diff in the TUI.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Guard the invariants and close out the feature.

- [X] T016 [P] Verify metadata isolation: confirm in `src/core/agent-loop.ts` that only `output` enters the `role: 'tool'` message (`metadata` stays on the `StepResult`). If no existing test covers it, add one asserting the pushed tool message `content === output` and contains no old-file content.
- [X] T017 Update docs to reflect the new core capability: in `ARCHITECTURE.md` §Tool Executor note that `executeTool` now returns `ToolResult` (with optional `metadata`) and that `write_file` is atomic (temp + rename); add `StepResult.metadata` to the Core-types mention if useful. In `AGENTS.md` Conventions, refresh the stale Vitest count ("161 tests across 10 files" → the current ~287/28). Keep edits scoped to these facts (surgical).
- [X] T018 Run the full gate — `pnpm build` clean and `pnpm test` green (existing suite + the two new test files) — then mark T051 ✅ DONE in `docs/todo/deferred-tui-items.md` (Priority Recommendation section).

---

## Dependencies — User Story completion order

```
Phase 1 (T001) ──▶ Phase 2 channel (T002,T003 ─▶ T004 ─▶ T005 ─▶ T006)
                                   │
                                   ├──▶ Phase 3 US1 (T007 ─▶ T008 ──▶ T009)   ← MVP
                                   │                         │
                                   │                         ▼
                                   └──▶ Phase 4 US2 (T010,T011,T012 ─▶ T013 ─▶ T014 ──▶ T015)
                                                                                      │
                                                                                      ▼
                                                          Phase 5 (T016, T017, T018)
```

- US2 depends on US1: the viewer reads `FileWriteMetadata` that only the safe-write handler emits.
- Phase 2 (channel) blocks both stories.

## Parallel execution opportunities

- **Phase 2**: T002 (`types.ts`) and T003 (`interface.ts`) are independent — run together.
- **Phase 4**: T010 (`file-write-meta.ts`), T011 (`line-diff.ts`), T012 (`types.ts` + `use-agent.ts`) are independent — run together before T013.
- **Phase 5**: T016 is independent of US2's UI tasks and can run alongside Phase 4.

## Implementation strategy (MVP first)

1. Land **Phase 1 + Phase 2 + Phase 3** (= US1) — corruption-safe `write_file` + the metadata channel. This is independently shippable and testable with no TUI changes.
2. Then **Phase 4** (US2) layers the diff viewer on the now-populated metadata.
3. **Phase 5** hardens invariants and closes the docs.

## Suggested MVP scope

**US1 only** (T001–T009): atomic write + old-content capture + the metadata channel. It removes the file-corruption risk (the PRD's #1 priority) and is fully verifiable via `write-file.test.ts` without any UI work. US2 (the viewer) is the visible payoff and follows immediately.
