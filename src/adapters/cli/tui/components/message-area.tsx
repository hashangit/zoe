import { Box, Static, Text, useStdout } from 'ink';
import { useTheme } from '../hooks/use-theme.js';
import { HORIZONTAL_PADDING } from '../layout.js';
import type { FeedEntry } from '../types.js';
import { UserMessage } from './user-message.js';
import { AssistantMessage } from './assistant-message.js';
import { ToolCallBlock } from './tool-call-block.js';
import { ErrorMessage } from './error-message.js';
import { InfoMessage } from './info-message.js';
import { LogoBanner } from './logo-banner.js';

/** Renders one feed entry by kind. */
function FeedItem({ entry, expanded }: { entry: FeedEntry; expanded: boolean }) {
  switch (entry.kind) {
    case 'user':
      return <UserMessage entry={entry} />;
    case 'assistant':
      return <AssistantMessage entry={entry} />;
    case 'tool':
      return <ToolCallBlock entry={entry} expanded={expanded} />;
    case 'error':
      return <ErrorMessage entry={entry} />;
    case 'info':
      return <InfoMessage entry={entry} />;
    case 'logo':
      return <LogoBanner />;
  }
}

/**
 * Scrollable feed. Completed entries render via Ink's `<Static>` (each item is
 * painted once and scrolls into the terminal's native scrollback); the
 * pending-permission prompt and "working…" indicator are live components in
 * `app.tsx`.
 *
 * Width handling: `<Static>` writes each item at the full terminal width and
 * ignores parent padding, so an item that fills `columns` triggers the
 * terminal's auto-wrap (a phantom row below). Each item is therefore capped at
 * `columns - HORIZONTAL_PADDING` with a matching left pad, giving a symmetric
 * gutter and keeping every line `< columns`. `useStdout` reads the live column
 * count so resize reflows correctly.
 */
export function MessageArea({ entries, staticKey, expanded }: { entries: FeedEntry[]; staticKey: number; expanded: boolean }) {
  const theme = useTheme();
  const { stdout } = useStdout();
  const columns = stdout?.columns ?? 80;
  const itemWidth = Math.max(20, columns - HORIZONTAL_PADDING);

  if (entries.length === 0) {
    return (
      <Box paddingLeft={HORIZONTAL_PADDING}>
        <Text color={theme.fgDim}>No messages yet — type a prompt and press Enter.</Text>
      </Box>
    );
  }
  return (
    // `key={staticKey}`: bumping it (on resize / expand-toggle) remounts
    // <Static> for a full repaint. The caller resets Ink's accumulated
    // `fullStaticOutput` first (see ink-reset.ts) so the remount doesn't
    // duplicate history. Normal appends still render incrementally.
    <Static key={staticKey} items={entries}>
      {(entry) => (
        <Box key={entry.id} width={itemWidth} paddingLeft={HORIZONTAL_PADDING}>
          <FeedItem entry={entry} expanded={expanded} />
        </Box>
      )}
    </Static>
  );
}
