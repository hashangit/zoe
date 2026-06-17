import { useInput } from 'ink';

export interface KeybindingHandlers {
  onAbort: () => void;
  onExit: () => void;
  onExpandToggle: () => void;
  onPalette: () => void;
  onClear: () => void;
}

/**
 * Global keybindings. Disabled while a modal overlay is open (`enabled: false`)
 * so the overlay owns input. Ctrl+C aborts mid-run or exits when idle.
 * (Help is `/?`, not bare `?` — bare `?` would fire mid-question.)
 */
export function useKeybindings(
  handlers: KeybindingHandlers,
  opts: { enabled: boolean; isRunning: boolean },
): void {
  useInput((input, key) => {
    if (!opts.enabled) return;
    if (key.ctrl) {
      if (input === 'o' || input === '\x0f') handlers.onExpandToggle();
      else if (input === 'p' || input === '\x10') handlers.onPalette();
      else if (input === 'l' || input === '\x0c') handlers.onClear();
      else if (input === 'c' || input === '\x03') (opts.isRunning ? handlers.onAbort() : handlers.onExit());
      return;
    }
    if (key.escape) handlers.onAbort();
  });
}
