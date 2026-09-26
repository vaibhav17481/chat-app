const SIZE_MAP = {
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-2xl",
};

const DOT_SIZE_MAP = {
  sm: "h-2 w-2 border",
  md: "h-3 w-3 border-2",
  lg: "h-3.5 w-3.5 border-2",
  xl: "h-4 w-4 border-2",
};

const GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-rose-500 to-orange-500",
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-blue-600",
  "from-fuchsia-500 to-pink-600",
  "from-amber-500 to-orange-600",
];

function gradientFor(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

/**
 * Avatar with image fallback -> initials, and an optional presence dot.
 * online: true | false | undefined (undefined = don't render a dot)
 */
function Avatar({ name, src, size = "md", online, className = "" }) {
  const initial = name?.trim()?.charAt(0)?.toUpperCase() || "?";

  return (
    <div className={`relative shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${SIZE_MAP[size]} rounded-full object-cover ring-1 ring-white/5`}
        />
      ) : (
        <div
          className={`${SIZE_MAP[size]} flex items-center justify-center rounded-full bg-gradient-to-br ${gradientFor(
            name
          )} font-display font-semibold text-white ring-1 ring-white/5`}
        >
          {initial}
        </div>
      )}

      {online !== undefined && (
        <span
          className={`absolute right-0 bottom-0 ${DOT_SIZE_MAP[size]} rounded-full border-surface ${
            online ? "bg-online" : "bg-slate-600"
          }`}
        />
      )}
    </div>
  );
}

export default Avatar;
