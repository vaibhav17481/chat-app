import { useEffect, useMemo, useRef, useState } from "react";

import { EMOJI_GROUPS } from "../../data/emojis";

function matches(emoji, query) {
  if (!query) return true;

  const needle = query.toLowerCase();

  return (
    emoji.char.includes(needle) ||
    emoji.keywords.some((keyword) => keyword.includes(needle))
  );
}

/**
 * Searchable emoji picker.
 *
 * onSelect receives the chosen emoji, onClose is called when the picker
 * should be dismissed (outside click or Escape).
 */
function EmojiPicker({
  onSelect,
  onClose,
  title = "Pick an emoji",
  compact = false,
}) {
  const [query, setQuery] = useState("");
  const pickerRef = useRef(null);

  const groups = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) return EMOJI_GROUPS;

    return EMOJI_GROUPS.map((group) => ({
      ...group,
      emojis: group.emojis.filter((emoji) => matches(emoji, trimmed)),
    })).filter((group) => group.emojis.length > 0);
  }, [query]);

  const total = groups.reduce((sum, group) => sum + group.emojis.length, 0);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose?.();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={pickerRef}
      role="dialog"
      aria-label={title}
      className={`w-[19rem] overflow-hidden rounded-xl border border-border bg-surface-raised shadow-xl ${
        compact ? "text-xs" : "text-sm"
      }`}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emoji..."
          aria-label="Search emoji"
          className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-muted"
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close emoji picker"
          className="rounded-md p-1 text-muted transition hover:bg-surface hover:text-ink"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="max-h-56 overflow-y-auto px-2 py-2">
        {total === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted">
            No emoji matches “{query}”
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="mb-2 last:mb-0">
              <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                {group.name}
              </p>

              <div className="grid grid-cols-8 gap-0.5">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji.char}
                    type="button"
                    title={emoji.keywords[0]}
                    aria-label={`Emoji ${emoji.char}`}
                    onClick={() => onSelect?.(emoji.char)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition hover:bg-surface hover:scale-110"
                  >
                    {emoji.char}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default EmojiPicker;
