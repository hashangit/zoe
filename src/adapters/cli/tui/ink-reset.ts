/**
 * Ink internals reset — the Command Code pattern, adapted for stock Ink 6.6.0
 * without a bundler.
 *
 * Why: `<Static>` renders each item once and freezes it, so resize-reflow and
 * tool-block expand/collapse (which need to re-render history) don't work.
 * Remounting `<Static>` via a `key` bump re-paints everything — BUT Ink
 * accumulates the re-emitted items in its internal `fullStaticOutput`, causing
 * duplicate "phantom" lines. Resetting `fullStaticOutput` + `lastOutput` before
 * the remount fixes that.
 *
 * Stock Ink doesn't expose the instance. Its `package.json` `exports` field
 * blocks `ink/build/instances.js` as a subpath, BUT importing the file by its
 * resolved absolute path (derived from the exported main entry) bypasses
 * package-exports enforcement — no bundler required.
 *
 * This is internals-poking, so it's shape-guarded: if a future Ink changes the
 * internal field names or the instances store, `resetInkStatic` returns false
 * and callers fall back to the frozen-on-resize behavior (no crash). Mirror of
 * Command Code's `registerInkControl` + `warnPatchSkipped`.
 */

import { createRequire } from 'node:module';
import * as path from 'node:path';

const nodeRequire = createRequire(import.meta.url);
const inkBuildDir = path.dirname(nodeRequire.resolve('ink'));

type InkInternal = { fullStaticOutput: string; lastOutput: string };
let inkInstances: WeakMap<object, InkInternal> | null | undefined;

/** Pre-load the internal instances store (async; call once at TUI start). */
export async function warmInkReset(): Promise<void> {
  if (inkInstances !== undefined) return;
  try {
    // Absolute-path import sidesteps Ink's `exports` restriction.
    const mod = await import(path.join(inkBuildDir, 'instances.js'));
    inkInstances = mod.default instanceof WeakMap ? mod.default : null;
  } catch {
    inkInstances = null;
  }
}

/**
 * Reset Ink's accumulated Static output + last-frame tracking so a `<Static>`
 * remount repaints cleanly. Returns false (no-op) if the internals are
 * unavailable or shaped differently than expected.
 */
export function resetInkStatic(stdout: object): boolean {
  if (!inkInstances) return false;
  const ink = inkInstances.get(stdout) as InkInternal | undefined;
  if (!ink) return false;
  if (typeof ink.fullStaticOutput !== 'string' || typeof ink.lastOutput !== 'string') {
    return false;
  }
  ink.fullStaticOutput = '';
  ink.lastOutput = '';
  return true;
}
