function TypingIndicator() {
  return (
    <div className="flex animate-fade-in-up justify-start py-1">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-surface-raised px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="animate-typing-dot h-1.5 w-1.5 rounded-full bg-muted"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export default TypingIndicator;
