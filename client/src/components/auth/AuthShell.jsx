/**
 * Shared shell for the authentication pages. It keeps the sign in, register
 * and verification screens on the same visual language as the chat itself.
 */
function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10 text-ink">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent font-display text-xl font-bold text-white shadow-lg shadow-accent/20">
            C
          </div>

          <h1 className="font-display text-2xl font-bold tracking-tight">
            {title}
          </h1>

          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-2xl shadow-black/40">
          {children}
        </div>

        {footer && (
          <div className="mt-5 text-center text-sm text-muted">{footer}</div>
        )}
      </div>
    </div>
  );
}

export default AuthShell;
