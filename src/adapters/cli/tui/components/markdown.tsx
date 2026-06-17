import React from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../hooks/use-theme.js';

// ── inline parsing: **bold**, `code`, [text](url) ───────────────────────

type Inline = { kind: 'text' | 'bold' | 'code' | 'link'; text: string; url?: string };

const INLINE_RE = /\*\*(.+?)\*\*|`(.+?)`|\[(.+?)\]\(([^)]+)\)/g;

function parseInline(text: string): Inline[] {
  const segments: Inline[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) segments.push({ kind: 'text', text: text.slice(last, m.index) });
    if (m[1] !== undefined) segments.push({ kind: 'bold', text: m[1] });
    else if (m[2] !== undefined) segments.push({ kind: 'code', text: m[2] });
    else if (m[3] !== undefined) segments.push({ kind: 'link', text: m[3], url: m[4] });
    last = INLINE_RE.lastIndex;
  }
  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) });
  return segments;
}

function InlineText({ text }: { text: string }): React.ReactElement {
  const theme = useTheme();
  const segments = parseInline(text);
  return (
    <Text>
      {segments.map((s, i) => {
        if (s.kind === 'bold') return <Text key={i} bold>{s.text}</Text>;
        if (s.kind === 'code') return <Text key={i} backgroundColor={theme.bgHighlight} color={theme.orange}>{s.text}</Text>;
        if (s.kind === 'link') return <Text key={i} color={theme.cyan}>{s.text}</Text>;
        return <Text key={i}>{s.text}</Text>;
      })}
    </Text>
  );
}

// ── block parsing ───────────────────────────────────────────────────────

type Block =
  | { type: 'code'; lines: string[] }
  | { type: 'heading'; text: string }
  | { type: 'list'; text: string }
  | { type: 'paragraph'; text: string };

function parseBlocks(content: string): Block[] {
  const lines = content.split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++; }
      i++; // closing fence
      blocks.push({ type: 'code', lines: code });
    } else if (/^#{1,6}\s/.test(line)) {
      blocks.push({ type: 'heading', text: line.replace(/^#{1,6}\s/, '') });
      i++;
    } else if (/^\s*[-*]\s+/.test(line)) {
      blocks.push({ type: 'list', text: line.replace(/^\s*[-*]\s+/, '') });
      i++;
    } else if (line.trim() === '') {
      i++; // collapse blanks
    } else {
      blocks.push({ type: 'paragraph', text: line });
      i++;
    }
  }
  return blocks;
}

/**
 * Minimal CommonMark-subset renderer for assistant messages: code fences,
 * inline code, **bold**, [links](url), bullet lists, and headings. Custom
 * (no `marked` dependency — its marked-terminal peer conflicts on v18).
 */
export function Markdown({ content }: { content: string }): React.ReactElement {
  const theme = useTheme();
  const blocks = parseBlocks(content);
  return (
    <Box flexDirection="column">
      {blocks.map((b, i) => {
        if (b.type === 'code') {
          return (
            <Box key={i} flexDirection="column" borderStyle="round" borderColor={theme.fgGutter} paddingLeft={1} paddingRight={1}>
              {b.lines.map((l, j) => (
                <Text key={j} color={theme.fgDim}>{l || ' '}</Text>
              ))}
            </Box>
          );
        }
        if (b.type === 'heading') {
          return (
            <Text key={i} bold color={theme.purple}>
              <InlineText text={b.text} />
            </Text>
          );
        }
        if (b.type === 'list') {
          return (
            <Box key={i}>
              <Text color={theme.green}>• </Text>
              <InlineText text={b.text} />
            </Box>
          );
        }
        return <Text key={i}><InlineText text={b.text} /></Text>;
      })}
    </Box>
  );
}
