import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useOtpCooldown,
  RESEND_COOLDOWN_SECONDS,
} from "../src/hooks/useOtpCooldown";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useOtpCooldown", () => {
  it("starts idle", () => {
    const { result } = renderHook(() => useOtpCooldown());

    expect(result.current.remaining).toBe(0);
    expect(result.current.active).toBe(false);
  });

  it("counts down from the given number of seconds", () => {
    const { result } = renderHook(() => useOtpCooldown());

    act(() => {
      result.current.start(30);
    });

    expect(result.current.remaining).toBe(30);
    expect(result.current.active).toBe(true);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.remaining).toBe(20);
  });

  it("reaches zero and becomes idle", () => {
    const { result } = renderHook(() => useOtpCooldown());

    act(() => {
      result.current.start(5);
    });

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(result.current.remaining).toBe(0);
    expect(result.current.active).toBe(false);
  });

  it("can be started again after it finished", () => {
    const { result } = renderHook(() => useOtpCooldown());

    act(() => {
      result.current.start(5);
    });

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    act(() => {
      result.current.start(30);
    });

    expect(result.current.remaining).toBe(30);
  });

  it("can be stopped", () => {
    const { result } = renderHook(() => useOtpCooldown());

    act(() => {
      result.current.start(30);
    });

    act(() => {
      result.current.stop();
    });

    expect(result.current.remaining).toBe(0);
    expect(result.current.active).toBe(false);
  });

  it("accepts an initial value so a countdown survives a page change", () => {
    const { result } = renderHook(() => useOtpCooldown(30));

    expect(result.current.remaining).toBe(30);
    expect(result.current.active).toBe(true);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.remaining).toBe(0);
  });

  it("uses a 30 second cooldown by default", () => {
    expect(RESEND_COOLDOWN_SECONDS).toBe(30);
  });
});
