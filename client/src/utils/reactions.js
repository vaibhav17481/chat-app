/**
 * Groups the raw reaction rows of a message into the bubbles shown under it.
 * Every entry knows how many people reacted and whether the current user is
 * one of them.
 */
export const groupReactions = (reactions = [], currentUserId) => {
  const groups = new Map();

  reactions.forEach((reaction) => {
    if (!reaction?.emoji) return;

    const group = groups.get(reaction.emoji) ?? {
      emoji: reaction.emoji,
      count: 0,
      mine: false,
      userIds: [],
    };

    group.count += 1;
    group.userIds.push(reaction.userId);

    if (reaction.userId === currentUserId) {
      group.mine = true;
    }

    groups.set(reaction.emoji, group);
  });

  return [...groups.values()].sort(
    (a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji),
  );
};

/** The emoji the given user currently used on a message (or null). */
export const findMyReaction = (reactions = [], currentUserId) =>
  reactions.find((reaction) => reaction.userId === currentUserId)?.emoji ??
  null;
