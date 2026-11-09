import { useCallback, useEffect, useState } from "react";

/** Minimum delay between two verification emails, in seconds. */
export const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Countdown used to throttle the "Resend OTP" button.
 *
 * The countdown is driven by an absolute deadline instead of a tick counter,
 * so it stays accurate even when the browser throttles timers in a
 * background tab.
 */
export function useOtpCooldown(initialSeconds = 0) {
  const [deadline, setDeadline] = useState(() =>
    initialSeconds > 0 ? Date.now() + initialSeconds * 1000 : 0
  );
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil(initialSeconds))
  );

  useEffect(() => {
    if (!deadline) {
      return undefined;
    }

    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

      setRemaining(left);

      if (left === 0) {
        setDeadline(0);
      }
    };

    tick();

    const interval = setInterval(tick, 250);

    return () => clearInterval(interval);
  }, [deadline]);

  /** Starts (or restarts) the countdown. */
  const start = useCallback((seconds = RESEND_COOLDOWN_SECONDS) => {
    const total = Math.max(1, Math.ceil(Number(seconds) || 0));

    setDeadline(Date.now() + total * 1000);
    setRemaining(total);
  }, []);

  /** Clears the countdown. */
  const stop = useCallback(() => {
    setDeadline(0);
    setRemaining(0);
  }, []);

  return {
    remaining,
    active: remaining > 0,
    start,
    stop,
  };
}
