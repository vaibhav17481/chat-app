import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { registerUser } from "../services/auth.service";
import { RESEND_COOLDOWN_SECONDS } from "../hooks/useOtpCooldown";

import AuthShell from "../components/auth/AuthShell";
import AuthAlert from "../components/auth/AuthAlert";
import AuthField from "../components/auth/AuthField";

function Register() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    try {
      setLoading(true);

      const result = await registerUser({
        username: username.trim(),
        email: email.trim(),
        password,
      });

      navigate("/verify-email", {
        state: {
          email: email.trim(),
          // A code was just mailed, so the resend button starts locked.
          cooldownRemaining:
            result?.cooldownRemaining || RESEND_COOLDOWN_SECONDS,
        },
      });
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="Join ChatApp and start connecting"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/" className="font-semibold text-accent hover:opacity-80">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <AuthAlert tone="error">{error}</AuthAlert>

        <AuthField
          id="register-username"
          label="Username"
          type="text"
          placeholder="Choose a username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />

        <AuthField
          id="register-email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <AuthField
          id="register-password"
          label="Password"
          type="password"
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          className="mb-6"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>
    </AuthShell>
  );
}

export default Register;
