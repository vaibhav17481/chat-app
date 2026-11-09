import { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import {
  loginUser,
  verifyEmail,
  resendVerificationCode,
} from "../services/auth.service";
import { setAccessToken } from "../services/api";

import { useAuth } from "../context/AuthContext";
import { useOtpCooldown, RESEND_COOLDOWN_SECONDS } from "../hooks/useOtpCooldown";

import AuthShell from "../components/auth/AuthShell";
import AuthAlert from "../components/auth/AuthAlert";
import AuthField from "../components/auth/AuthField";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [notice, setNotice] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);

  // Refs guard against duplicate requests: a double click, an Enter key press
  // while the first request is still running, or a re-render must never send
  // a second verification email.
  const loginInFlightRef = useRef(false);
  const verifyInFlightRef = useRef(false);
  const resendInFlightRef = useRef(false);

  const navigate = useNavigate();
  const { setUser } = useAuth();
  const {
    remaining,
    active: cooldownActive,
    start: startCooldown,
    stop: stopCooldown,
  } = useOtpCooldown();

  const handleEmailChange = (event) => {
    const nextEmail = event.target.value;

    setEmail(nextEmail);

    // A pending code belongs to the previous address, so it is dropped when
    // the address changes. The panel itself stays open.
    if (nextEmail.trim() && nextEmail.trim() !== email.trim()) {
      setCode("");
      setNotice("");
      stopCooldown();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loginInFlightRef.current) {
      return;
    }

    setError("");
    setSuccess("");
    setNotice("");

    loginInFlightRef.current = true;

    try {
      setLoading(true);

      const data = await loginUser({ email: email.trim(), password });

      // The access token only lives in memory. The refresh token was set as
      // an httpOnly cookie by the server.
      setAccessToken(data.token);
      setUser(data.user);

      navigate("/home");
    } catch (err) {
      const status = err.response?.status;
      const payload = err.response?.data;

      if (status === 403 && payload?.requiresVerification) {
        // The account exists but is not verified yet. The server has just
        // mailed a 6-digit code, so the verification panel opens right away.
        setShowOtp(true);
        setError("");
        setSuccess("");
        setCodeRequested(Boolean(payload.codeSent));
        setNotice(
          payload.codeSent
            ? "We sent a 6-digit verification code to your email. Enter it below to continue."
            : "A verification code was already sent to your email. Enter it below to continue."
        );

        if (payload.cooldownRemaining > 0) {
          startCooldown(payload.cooldownRemaining);
        }

        return;
      }

      setError(payload?.message || "Login failed. Please try again.");
    } finally {
      loginInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();

    if (verifyInFlightRef.current) {
      return;
    }

    setError("");
    setSuccess("");
    setNotice("");

    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    verifyInFlightRef.current = true;

    try {
      setVerifying(true);

      await verifyEmail({ email: email.trim(), code: code.trim() });

      setShowOtp(false);
      setCode("");
      setPassword("");
      stopCooldown();

      setSuccess("Email verified successfully! You can now sign in.");
    } catch (err) {
      setError(err.response?.data?.message || "Email verification failed.");
    } finally {
      verifyInFlightRef.current = false;
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendInFlightRef.current || cooldownActive) {
      return;
    }

    setError("");
    setSuccess("");
    setNotice("");

    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }

    resendInFlightRef.current = true;

    try {
      setResending(true);

      const data = await resendVerificationCode({ email: email.trim() });

      setSuccess(
        data.message || "A new verification code has been sent to your email."
      );
      setCode("");
      setCodeRequested(true);
      startCooldown(data.cooldownRemaining || RESEND_COOLDOWN_SECONDS);
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
        setError(payload?.message || "Failed to resend the verification code.");
      }
    } finally {
      resendInFlightRef.current = false;
      setResending(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue to ChatApp"
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/register" className="font-semibold text-accent hover:opacity-80">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <AuthAlert tone="error">{error}</AuthAlert>
        <AuthAlert tone="success">{success}</AuthAlert>
        <AuthAlert tone="info">{notice}</AuthAlert>

        <AuthField
          id="login-email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={handleEmailChange}
          autoComplete="email"
          required
        />

        <AuthField
          id="login-password"
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="mb-4"
        />

        <button
          type="submit"
          disabled={loading || verifying || resending}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        {!showOtp && (
          <button
            type="button"
            onClick={() => {
              setShowOtp(true);
              setError("");
              setSuccess("");
            }}
            className="mt-3 w-full rounded-xl border border-border py-3 font-semibold text-accent transition hover:bg-accent/10"
          >
            Verify Your Email
          </button>
        )}

        {showOtp && (
          <div className="mt-5 rounded-xl border border-border bg-surface-raised p-4">
            <h2 className="font-display font-semibold">Email Verification</h2>

            <p className="mt-2 text-sm text-muted">
              Enter the 6-digit code sent to your email.
            </p>

            {!codeRequested && (
              <p className="mt-1 text-sm text-muted/70">
                No code requested yet? Use "Resend OTP" below to get one.
              </p>
            )}

            <label
              htmlFor="login-otp-code"
              className="mb-2 mt-4 block text-sm font-medium text-muted"
            >
              Verification code
            </label>

            <input
              id="login-otp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleVerifyEmail(e);
                }
              }}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-center text-xl tracking-[0.4em] text-ink outline-none transition placeholder:text-muted/50 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />

            <button
              type="button"
              onClick={handleVerifyEmail}
              disabled={verifying || code.length !== 6}
              className="mt-3 w-full rounded-xl bg-online py-3 font-semibold text-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {verifying ? "Verifying..." : "Verify Email"}
            </button>

            <button
              type="button"
              onClick={handleResendOtp}
              disabled={
                resending || verifying || cooldownActive || !email.trim()
              }
              className="mt-3 w-full rounded-xl border border-border py-3 font-semibold text-muted transition hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
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
          </div>
        )}
      </form>
    </AuthShell>
  );
}

export default Login;
