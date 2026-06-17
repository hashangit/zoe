import { Box, Text } from 'ink';
import { useTheme } from '../hooks/use-theme.js';
import type { UserMessageEntry } from '../types.js';

/** A user input entry — green speaker token + content. */
export function UserMessage({ entry }: { entry: UserMessageEntry }) {
  const theme = useTheme();
  return (
    <Box>
      <Text color={theme.green} bold>You › </Text>
      <Text color={theme.fg}>{entry.content}</Text>
    </Box>
  );
}
