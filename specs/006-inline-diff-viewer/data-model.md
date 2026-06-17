# Data Model — Inline Diff Viewer + Safe Write (T051)

**Phase 1 output.** Entities touched by this feature. No persistence/schema
changes — this is an in-memory metadata channel + a new UI component.

## E1 — `ToolResult` (existing, now used end-to-end)

`src/core/types.ts:97` — **no shape change**, but it becomes the canonical
return type of `executeTool` instead of an internal SDK type.

```ts
interface ToolResult {
  output: string;                       // what the LLM sees + the tool message
  success: boolean;                     // advisory (handlers signal via output today)
  metadata?: Record<string, unknown>;   // tool-specific, consumer-negotiated — NOT sent to the LLM
}
```

**Invariant**: `metadata` never enters message history; it rides only on the
`StepResult`. `output` is the sole content the provider ever sees.

## E2 — `StepResult.metadata` (NEW, top-level)

`src/core/types.ts:48` — add one optional field:

```ts
interface StepResult {
  type: "text" | "tool_call" | "text_delta" | "tool_progress";
  content?: string;
  toolCall?: { id; name; args; result; duration };
  toolCallId?: string; name?: string; args?: Record<string, unknown>;
  metadata?: Record<string, unknown>;   // NEW — populated for tool_call steps whose handler returned metadata
  timestamp: number;
}
```

Top-level (not nested under `toolCall`) so future step types (e.g. T052
reasoning) can reuse the slot.

## E3 — `FileWriteMetadata` (NEW; producer-owned type, TUI-owned guard)

The shape `write_file` writes into `ToolResult.metadata`, and the TUI reads from
`StepResult.metadata`.

**Ownership (single source of truth, constitution §II + clean layering §I):**
- The **type** is owned by its producer — `export interface FileWriteMetadata`
  in `src/tools/core.ts`, next to `WriteFileTool`. The handler returns this exact
  shape, so the contract is compile-checked at the source.
- The **parse guard** `isFileWriteMetadata(u: unknown): u is FileWriteMetadata`
  lives TUI-side in `src/adapters/cli/tui/diff/file-write-meta.ts`, with a
  **type-only** import of `FileWriteMetadata` from `../../../tools/core.js`
  (Adapter → Infrastructure is the allowed dependency direction; type-only =
  erased at runtime, no bundling of tool code into the TUI).

```ts
// src/tools/core.ts — producer owns the contract
export interface FileWriteMetadata {
  path: string;
  oldContent: string | null;   // null ⇒ new file
  newContent: string;
  isNewFile: boolean;
  byteDelta: number;           // newBytes - oldBytes
  diffSkipped?: boolean;       // true when over the size/line cap
  skipReason?: string;         // e.g. "file > 64 KB / 2000 lines"
}
```

Consumed **only** by `ToolCallBlock` when `entry.name === 'write_file'` and
`isFileWriteMetadata(metadata)` passes. Unknown/absent metadata → plain rendering.

## E4 — `DiffViewLine` (NEW, view-model, TUI-only)

Derived from `Diff.diffLines(old, new)` inside `DiffViewer`; never persisted:

```ts
type DiffViewLine =
  | { kind: 'added';    newLineNo: number; text: string }
  | { kind: 'removed';  oldLineNo: number; text: string }
  | { kind: 'context';  oldLineNo: number; newLineNo: number; text: string };
```

A small transform (`diffPartsToViewLines`) maps `diff`'s `{added, removed,
value}` parts onto this, tracking old/new line counters (Pi's
`generateDiffString` pattern).

## Relationships

```
write_file handler ──returns──▶ ToolResult { output, metadata: FileWriteMetadata }
                                       │
executeTool ──normalizes──▶ ToolResult (preserves metadata)
                                       │
agent-loop ──attaches──▶ StepResult.metadata (for tool_call steps)
                                       │
ToolCallBlock ──reads──▶ FileWriteMetadata ──▶ DiffViewer ──▶ DiffViewLine[]
```

**Ownership along that chain**: the `FileWriteMetadata` *type* is defined at the
producer (`src/tools/core.ts`); the *parse guard* (`isFileWriteMetadata`) runs at
the consumer boundary (`tui/diff/file-write-meta.ts`). `DiffViewLine` and the
diff transform are TUI-only.

No database, no migration, no session-format change. Metadata is ephemeral
(lives on the step for the session; not serialized into `SessionData` in v1 —
on resume, old tool steps render without diffs, which is acceptable).
