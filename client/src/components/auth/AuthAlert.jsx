const TONES = {
  error: "border-red-500/30 bg-red-500/10 text-red-300",
  success: "border-online/30 bg-online/10 text-online",
  info: "border-accent/30 bg-accent/10 text-accent",
};

/** Inline message box used on the authentication pages. */
function AuthAlert({ tone = "error", children }) {
  if (!children) {
    return null;
  }

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mb-5 rounded-xl border p-3 text-sm ${TONES[tone] ?? TONES.error}`}
    >
      {children}
    </div>
  );
}

export default AuthAlert;
