import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MessageInput from "../src/components/chat/MessageInput";

afterEach(() => {
  cleanup();
});

const renderInput = (props = {}) => {
  const onSend = vi.fn();
  const onCancelReply = vi.fn();

  render(
    <MessageInput
      onSend={onSend}
      onTyping={vi.fn()}
      onCancelReply={onCancelReply}
      {...props}
    />,
  );

  return { onSend, onCancelReply };
};

const typeMessage = (value) =>
  fireEvent.change(screen.getByLabelText("Message"), { target: { value } });

describe("MessageInput", () => {
  it("opens the emoji picker from the input", () => {
    renderInput();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Open emoji picker"));

    expect(
      screen.getByRole("dialog", { name: "Insert emoji" }),
    ).toBeInTheDocument();
  });

  it("inserts the chosen emoji into the message", () => {
    renderInput();

    fireEvent.click(screen.getByLabelText("Open emoji picker"));
    fireEvent.click(screen.getByLabelText("Emoji 😀"));

    const textarea = screen.getByLabelText("Message");

    expect(textarea.value).toBe("😀");
  });

  it("inserts the emoji at the cursor position", () => {
    renderInput();

    const textarea = screen.getByLabelText("Message");

    typeMessage("hello ");

    textarea.setSelectionRange(6, 6);

    fireEvent.click(screen.getByLabelText("Open emoji picker"));
    fireEvent.click(screen.getByLabelText("Emoji 😀"));

    expect(screen.getByLabelText("Message").value).toBe("hello 😀");
  });

  it("searches the emoji catalogue", () => {
    renderInput();

    fireEvent.click(screen.getByLabelText("Open emoji picker"));

    expect(screen.getByLabelText("Emoji 🔥")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search emoji"), {
      target: { value: "fire" },
    });

    expect(screen.getByLabelText("Emoji 🔥")).toBeInTheDocument();
    expect(screen.queryByLabelText("Emoji 😀")).not.toBeInTheDocument();
  });

  it("shows the message that is being replied to", () => {
    renderInput({
      replyTo: {
        id: 12,
        content: "the original message",
        sender: { username: "alice", displayName: "Alice" },
      },
    });

    expect(screen.getByText("Replying to Alice")).toBeInTheDocument();
    expect(screen.getByText("the original message")).toBeInTheDocument();
  });

  it("cancels the reply", () => {
    const { onCancelReply } = renderInput({
      replyTo: {
        id: 12,
        content: "the original message",
        sender: { username: "alice" },
      },
    });

    fireEvent.click(screen.getByLabelText("Cancel reply"));

    expect(onCancelReply).toHaveBeenCalledTimes(1);
  });

  it("marks a deleted original message as deleted", () => {
    renderInput({
      replyTo: {
        id: 12,
        content: "This message was deleted",
        deleted: true,
        sender: { username: "alice" },
      },
    });

    expect(screen.getByText("This message was deleted")).toBeInTheDocument();
  });

  it("sends the message together with the reply target", () => {
    const { onSend } = renderInput({
      replyTo: {
        id: 12,
        content: "the original message",
        sender: { username: "alice" },
      },
    });

    typeMessage("my answer");
    fireEvent.click(screen.getByLabelText("Send message"));

    expect(onSend).toHaveBeenCalledWith("my answer", 12);
  });

  it("sends a message without a reply target", () => {
    const { onSend } = renderInput();

    typeMessage("hello");
    fireEvent.click(screen.getByLabelText("Send message"));

    expect(onSend).toHaveBeenCalledWith("hello", null);
  });
});
