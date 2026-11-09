export const authInputClass =
  "w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-ink outline-none transition placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/20";

/** Label and input pair used on the authentication pages. */
function AuthField({ id, label, className = "", ...props }) {
  return (
    <div className="mb-5">
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-muted">
        {label}
      </label>

      <input
        id={id}
        className={`${authInputClass} ${className}`}
        {...props}
      />
    </div>
  );
}

export default AuthField;
