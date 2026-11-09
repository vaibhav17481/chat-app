import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { verifyEmail, resendVerificationCode } from "../services/auth.service";
import {
  useOtpCooldown,
  RESEND_COOLDOWN_SECONDS,
} from "../hooks/useOtpCooldown";

import AuthShell from "../components/auth/AuthShell";
import AuthAlert from "../components/auth/AuthAlert";
import AuthField, { authInputClass } from "../components/auth/AuthField";

function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState(location.state?.email || "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Guards against duplicate requests.
  const verifyInFlightRef = useRef(false);
  const resendInFlightRef = useRef(false);

  // A code was already mailed while the account was being created.
  const {
    remaining,
    active: cooldownActive,
    start: startCooldown,
  } = useOtpCooldown(location.state?.cooldownRemaining || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (verifyInFlightRef.current) {
      return;
    }

    setError("");
    setSuccess("");

    if (!email.trim() || !/^\d{6}$/.test(code)) {
      setError("Enter your email and a valid 6-digit code.");
      return;
    }

    verifyInFlightRef.current = true;

    try {
      setLoading(true);

      const result = await verifyEmail({
        email: email.trim(),
        code: code.trim(),
      });

      setSuccess(result.message || "Email verified successfully!");

      setTimeout(() => navigate("/"), 1200);
    } catch (err) {
      setError(
        err.response?.data?.message || "Verification failed. Please try again."
      );
    } finally {
      verifyInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendInFlightRef.current || cooldownActive) {
      return;
    }

    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }

    resendInFlightRef.current = true;

    try {
      setResending(true);

      const result = await resendVerificationCode({ email: email.trim() });

      setSuccess(
        result.message || "A new verification code has been sent to your email."
      );
      setCode("");
      startCooldown(result.cooldownRemaining || RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      const status = err.response?.status;
      const payload = err.response?.data;

      if (status === 429) {
        const retryAfter =
          payload?.retryAfter ??
          payload?.cooldownRemaining ??
          RESEND_COOLDOWN_SECONDS;

        startCooldown(retryAfter);
        setError(
          payload?.message || "Please wait before requesting another code."
        );
      } else {
        setError(
          payload?.message || "Failed to resend the verification code."
        );
      }
    } finally {
      resendInFlightRef.current = false;
      setResending(false);
    }
  };

  return (
    <AuthShell
      title="Verify your email"
      subtitle="Enter the 6-digit code sent to your email address."
      footer={
        <>
          Already verified?{" "}
          <Link to="/" className="font-semibold text-accent hover:opacity-80">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <AuthAlert tone="error">{error}</AuthAlert>
        <AuthAlert tone="success">{success}</AuthAlert>

        <AuthField
          id="verify-email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <label
          htmlFor="verify-code"
          className="mb-2 block text-sm font-medium text-muted"
        >
          Verification code
        </label>

        <input
          id="verify-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          required
          className={`${authInputClass} mb-6 text-center text-2xl tracking-[0.5em]`}
        />

        <button
          type="submit"
          disabled={loading || !!success}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Verifying..." : "Verify Email"}
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={resending || loading || cooldownActive || !email.trim()}
          className="mt-3 w-full rounded-xl border border-border py-3 font-semibold text-muted transition hover:bg-surface-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cooldownActive
            ? `Resend OTP in ${remaining}s`
            : resending
              ? "Sending..."
              : "Resend OTP"}
        </button>

        {cooldownActive && (
          <p className="mt-2 text-center text-xs text-muted">
            You can request a new code in {remaining} second
            {remaining === 1 ? "" : "s"}.
          </p>
        )}
      </form>
    </AuthShell>
  );
}

export default VerifyEmail;
