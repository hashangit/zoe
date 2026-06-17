import { Box, Text, useInput } from 'ink';
import { useTheme } from '../hooks/use-theme.js';

interface PermissionPromptProps {
  toolName: string;
  args: Record<string, unknown>;
  /** Called once with the user's decision. Double-fires are no-ops (use-agent clears the resolver). */
  onResolve: (approve: boolean) => void;
}

/** One-line preview of the tool args. */
function formatArgs(args: Record<string, unknown>): string {
  if (typeof args.command === 'string' && args.command.length > 0) return args.command;
  const json = JSON.stringify(args);
  return json === '{}' ? '' : json;
}

/**
 * Inline tool-approval prompt rendered in the feed while the agent is paused
 * on `approveTool`. Stays within Ink's input handling — no stdin mode switch
 * (unlike the readline path's inquirer suspend/resume).
 */
export function PermissionPrompt({ toolName, args, onResolve }: PermissionPromptProps) {
  const theme = useTheme();
  useInput((input) => {
    const key = input.toLowerCase();
    if (key === 'y') onResolve(true);
    else if (key === 'n') onResolve(false);
  });

  const argsPreview = formatArgs(args);

  return (
    <Box borderStyle="round" borderColor={theme.yellow} paddingLeft={1} paddingRight={1}>
      <Text color={theme.yellow} bold>? </Text>
      <Text color={theme.fg}>Run </Text>
      <Text color={theme.purple} bold>{toolName}</Text>
      {argsPreview ? <Text color={theme.fgDim}> {truncate(argsPreview, 100)}</Text> : null}
      <Text color={theme.fg}>? [</Text>
      <Text color={theme.green} bold>y</Text>
      <Text color={theme.fg}>/</Text>
      <Text color={theme.red} bold>n</Text>
      <Text color={theme.fg}>]</Text>
    </Box>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}
