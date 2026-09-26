function ChatEmptyState({
  icon = "💬",
  title = "Select a conversation",
  description = "Choose a friend from the list to start chatting.",
}) {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-raised text-3xl">
        {icon}
      </div>
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1.5 max-w-xs text-sm text-muted">{description}</p>
    </div>
  );
}

export default ChatEmptyState;
