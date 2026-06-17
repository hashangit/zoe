import { Box, Text } from 'ink';
import { useTheme } from '../hooks/use-theme.js';
import type { InfoEntry } from '../types.js';

/** An info/warning/status line entry — dim, no speaker token. */
export function InfoMessage({ entry }: { entry: InfoEntry }) {
  const theme = useTheme();
  return (
    <Box>
      <Text color={theme.fgDim}>{entry.content}</Text>
    </Box>
  );
}
