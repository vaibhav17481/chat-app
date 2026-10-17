import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { verifyEmail } from "../services/auth.service";

function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState(location.state?.email || "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim() || !/^\d{6}$/.test(code)) {
      setError("Enter your email and a valid 6-digit code.");
      return;
    }

    try {
      setLoading(true);

      const result = await verifyEmail({
        email: email.trim(),
        code: Number(code),
      });

      setSuccess(result.message || "Email verified successfully!");

      setTimeout(() => navigate("/"), 1200);
    } catch (err) {
      setError(
        err.response?.data?.message || "Verification failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-600 text-3xl">
            ✉️
          </div>

          <h1 className="text-3xl font-bold">Verify your email</h1>

          <p className="mt-2 text-slate-400">
            Enter the 6-digit code sent to your email address.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
        >
          {error && (
            <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-5 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-400">
              {success}
            </div>
          )}

          <label className="mb-2 block text-sm font-medium text-slate-300">
            Email
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="mb-5 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-purple-500"
          />

          <label className="mb-2 block text-sm font-medium text-slate-300">
            Verification code
          </label>

          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            required
            className="mb-6 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-purple-500"
          />

          <button
            type="submit"
            disabled={loading || !!success}
            className="w-full rounded-xl bg-purple-600 py-3 font-semibold transition hover:bg-purple-500 disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify Email"}
          </button>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already verified?{" "}
            <Link to="/" className="font-semibold text-purple-400">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default VerifyEmail;
