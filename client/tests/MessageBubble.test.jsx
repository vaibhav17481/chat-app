import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MessageBubble from "../src/components/chat/MessageBubble";

afterEach(() => {
  cleanup();
});

const baseMessage = {
  id: 5,
  senderId: 2,
  receiverId: 1,
  content: "hello there",
  status: "SENT",
  createdAt: "2026-10-22T10:00:00.000Z",
  reactions: [],
};

const renderBubble = (message = {}, props = {}) => {
  const onReply = vi.fn();
  const onReact = vi.fn();
  const onJumpToReply = vi.fn();

  render(
    <MessageBubble
      message={{ ...baseMessage, ...message }}
      isMine={false}
      currentUserId={1}
      onReply={onReply}
      onReact={onReact}
      onJumpToReply={onJumpToReply}
      {...props}
    />,
  );

  return { onReply, onReact, onJumpToReply };
};

describe("MessageBubble replies", () => {
  it("shows the message that is replied to", () => {
    renderBubble({
      replyTo: {
        id: 3,
        senderId: 2,
        content: "the first message",
        sender: { username: "alice", displayName: "Alice" },
      },
    });

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("the first message")).toBeInTheDocument();
  });

  it("falls back to the username when no display name is set", () => {
    renderBubble({
      replyTo: {
        id: 3,
        senderId: 2,
        content: "the first message",
        sender: { username: "alice" },
      },
    });

    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("marks a deleted original message as deleted", () => {
    renderBubble({
      replyTo: {
        id: 3,
        senderId: 2,
        content: "This message was deleted",
        deleted: true,
        sender: { username: "alice" },
      },
    });

    expect(screen.getByText("This message was deleted")).toBeInTheDocument();
  });

  it("jumps to the original message when the preview is clicked", () => {
    const { onJumpToReply } = renderBubble({
      replyTo: {
        id: 3,
        senderId: 2,
        content: "the first message",
        sender: { username: "alice" },
      },
    });

    fireEvent.click(
      screen.getByLabelText("Jump to the message of alice"),
    );

    expect(onJumpToReply).toHaveBeenCalledWith(3);
  });

  it("offers a reply action", () => {
    const { onReply } = renderBubble();

    fireEvent.click(screen.getByText("hello there"));
    fireEvent.click(screen.getByLabelText("Reply to this message"));

    expect(onReply).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5, content: "hello there" }),
    );
  });
});

describe("MessageBubble reactions", () => {
  it("shows the reactions with their count", () => {
    renderBubble({
      reactions: [
        { id: 1, userId: 1, emoji: "👍" },
        { id: 2, userId: 2, emoji: "👍" },
        { id: 3, userId: 2, emoji: "🎉" },
      ],
    });

    const thumbs = screen.getByLabelText("👍 reaction, 2");
    const party = screen.getByLabelText("🎉 reaction, 1");

    expect(thumbs).toBeInTheDocument();
    expect(party).toBeInTheDocument();

    // the current user is one of the two 👍 reactions
    expect(thumbs).toHaveAttribute("aria-pressed", "true");
    expect(party).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles a reaction when a reaction bubble is clicked", () => {
    const { onReact } = renderBubble({
      reactions: [{ id: 1, userId: 1, emoji: "👍" }],
    });

    fireEvent.click(screen.getByLabelText("👍 reaction, 1"));

    expect(onReact).toHaveBeenCalledWith(5, "👍");
  });

  it("reacts with the emoji chosen in the picker", () => {
    const { onReact } = renderBubble();

    fireEvent.click(screen.getByText("hello there"));
    fireEvent.click(screen.getByLabelText("React to this message"));
    fireEvent.click(screen.getByLabelText("Emoji 👍"));

    expect(onReact).toHaveBeenCalledWith(5, "👍");
  });

  it("hides the reaction bubbles of a deleted message", () => {
    renderBubble({
      deleted: true,
      content: "This message was deleted",
      reactions: [{ id: 1, userId: 1, emoji: "👍" }],
    });

    expect(screen.queryByLabelText("👍 reaction, 1")).not.toBeInTheDocument();
  });
});
