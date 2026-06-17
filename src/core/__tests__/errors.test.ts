import { describe, it, expect } from "vitest";
import {
  ZoeError,
  ProviderError,
  ToolError,
  MaxStepsError,
  AbortedError,
} from "../errors.js";

describe("ZoeError", () => {
  it("stores code and retryable", () => {
    const err = new ZoeError("something broke", "GENERIC", false);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ZoeError);
    expect(err.message).toBe("something broke");
    expect(err.code).toBe("GENERIC");
    expect(err.retryable).toBe(false);
    expect(err.name).toBe("ZoeError");
  });

  it("defaults retryable to false", () => {
    const err = new ZoeError("msg", "CODE");
    expect(err.retryable).toBe(false);
  });

  it("accepts retryable=true", () => {
    const err = new ZoeError("msg", "CODE", true);
    expect(err.retryable).toBe(true);
  });
});

describe("ProviderError", () => {
  it("is a ZoeError with code PROVIDER_ERROR", () => {
    const err = new ProviderError("rate limited");
    expect(err).toBeInstanceOf(ZoeError);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.code).toBe("PROVIDER_ERROR");
    expect(err.retryable).toBe(true);
    expect(err.name).toBe("ProviderError");
  });

  it("stores optional provider name", () => {
    const err = new ProviderError("fail", "openai");
    expect(err.provider).toBe("openai");
  });

  it("leaves provider undefined when not passed", () => {
    const err = new ProviderError("fail");
    expect(err.provider).toBeUndefined();
  });
});

describe("ToolError", () => {
  it("is a ZoeError with code TOOL_FAILED", () => {
    const err = new ToolError("tool crashed");
    expect(err).toBeInstanceOf(ZoeError);
    expect(err).toBeInstanceOf(ToolError);
    expect(err.code).toBe("TOOL_FAILED");
    expect(err.retryable).toBe(true);
    expect(err.name).toBe("ToolError");
  });

  it("stores optional tool name", () => {
    const err = new ToolError("bad", "execute_shell_command");
    expect(err.tool).toBe("execute_shell_command");
  });
});

describe("MaxStepsError", () => {
  it("formats message and stores steps", () => {
    const err = new MaxStepsError(15, 10);
    expect(err).toBeInstanceOf(ZoeError);
    expect(err).toBeInstanceOf(MaxStepsError);
    expect(err.message).toBe("Maximum steps reached (15/10)");
    expect(err.code).toBe("MAX_STEPS");
    expect(err.retryable).toBe(false);
    expect(err.steps).toBe(15);
    expect(err.name).toBe("MaxStepsError");
  });
});

describe("AbortedError", () => {
  it("uses default message when none provided", () => {
    const err = new AbortedError();
    expect(err).toBeInstanceOf(ZoeError);
    expect(err).toBeInstanceOf(AbortedError);
    expect(err.message).toBe("Operation was aborted");
    expect(err.code).toBe("ABORTED");
    expect(err.retryable).toBe(false);
    expect(err.name).toBe("AbortedError");
  });

  it("accepts custom message", () => {
    const err = new AbortedError("user cancelled");
    expect(err.message).toBe("user cancelled");
  });
});
