# Quickstart — Inline Diff Viewer + Safe Write (T051)

**Phase 1 output.** Runnable validation scenarios. Each maps to a user-story
acceptance criterion in `spec.md` and proves the feature end-to-end. Prereq:
`pnpm install` (adds `diff`), `pnpm build` green.

## Setup

```bash
pnpm install            # adds `diff` (engine — see research.md R1)
pnpm test               # baseline green
pnpm dev                # interactive TUI
```

## Scenario 1 — Safe write, new file (US1)

1. In the TUI, ask the agent to create a new file, e.g. *"create `tmp/hello.txt`
   with the line `hi there`"*.
2. **Expect**: file created; tool-call block renders an **all-green** diff (every
   line added); footer/output shows `Successfully wrote to tmp/hello.txt (0 -> 1 lines)`.
3. **Verify**: `cat tmp/hello.txt` → `hi there`. No `.tmp` file left behind.

## Scenario 2 — Safe write, edit (US1 + US2)

1. Ask the agent to change line 1 of `tmp/hello.txt` to `hello world`.
2. **Expect**: tool-call block renders a **mixed** diff — red `-hi there`, green
   `+hello world`; old content captured (metadata, not in `output`).
3. **Verify**: `git diff tmp/hello.txt` (or `cat`) shows the new content.
4. **Verify metadata isolation**: the assistant's next turn does *not* echo the
   old file content (metadata never entered the tool message).

## Scenario 3 — Atomic crash-safety (US1, automated)

Unit test in `src/tools/__tests__/write-file.test.ts`:
1. Stub `fs.rename` to throw (simulate failure / crash mid-write).
2. Pre-seed `tmp/target.txt` with `"ORIGINAL"`.
3. Call the `write_file` handler with new content `"CHANGED"`.
4. **Expect**: handler returns an error `output`; the file on disk is still
   `"ORIGINAL"`; no `*.tmp` file remains.
5. **Expect**: `metadata` reflects the failed state or is absent — the original
   is never partially overwritten.

## Scenario 4 — Large-file skip (US2)

1. Ask the agent to write a > 64 KB (or > 2000-line) file.
2. **Expect**: tool-call block renders a plain "file written (N lines)" note —
   `metadata.diffSkipped === true` — no multi-thousand-line diff dump.
3. **Verify**: file content correct on disk.

## Scenario 5 — CRLF file (US2)

1. Create a CRLF file; ask the agent to change one line.
2. **Expect**: diff shows only the changed line, **not** the whole file (old/new
   normalized to LF for comparison); the file is written with the new content
   verbatim.

## Scenario 6 — Backward compatibility (US1)

1. Ask the agent to `read_file` or run any non-`write_file` tool.
2. **Expect**: tool-call block renders exactly as before (no metadata → no diff).
3. **Verify**: `executeTool` normalizes a bare-string handler return to
   `{ output, success: true }`; `pnpm test` (existing suite) stays green.

## Scenario 7 — Diff collapse/expand (US2)

1. Trigger a multi-hunk `write_file` edit.
2. **Expect**: collapsed view shows the first changed hunk + `... N more`;
   context lines are elided (`... N skipped`) between hunks (Pi-style).
3. Press the expand toggle (Ctrl+O). **Expect**: full diff with line numbers.

## Automated gates

- `pnpm test` — the existing Vitest suite + new `write-file.test.ts` (safe write) and
  `diff-viewer.test.ts` (render snapshot via `ink-testing-library`) stay green.
- `pnpm build` — `tsc` clean (widened `executeTool` / `ToolModule.handler` types
  compile across the 3 call sites in `agent-loop.ts`).
