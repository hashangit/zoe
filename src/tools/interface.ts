import type { ToolRiskCategory, ToolContext, ToolResult } from "../core/types.js";

/** Optional execution context pieces a caller (the agent loop) can pass in. */
export type ToolExecExtra = Pick<ToolContext, "onUpdate" | "signal">;

export interface ToolDefinition {
  type: "function";
  function: {
    name: "execute_shell_command" | "read_file" | "write_file" | "send_email" | string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

export interface ToolModule {
  name: string; // Display name for setup (e.g., "Email Service")
  configKeys?: string[]; // Keys needed in setting.json (e.g., ["smtpHost", "smtpUser"])
  risk?: ToolRiskCategory;
  definition: ToolDefinition; // OpenAI Tool Definition
  // Implementation. `extra` carries optional onUpdate (live progress) + signal.
  // May return a structured ToolResult to carry metadata (e.g. write_file's
  // old/new content for the diff viewer); plain strings still work everywhere.
  handler: (args: any, config?: any, extra?: ToolExecExtra) => Promise<string | ToolResult>;
}
