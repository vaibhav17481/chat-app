import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetConversation,
  mockSendMessage,
  mockEditMessage,
  mockDeleteMessage,
  mockToggleReaction,
  mockGetUserById,
  mockNotifySeen,
  mockSocketHandlers,
  mockSocket,
} = vi.hoisted(() => ({
  mockGetConversation: vi.fn(),
  mockSendMessage: vi.fn(),
  mockEditMessage: vi.fn(),
  mockDeleteMessage: vi.fn(),
  mockToggleReaction: vi.fn(),
  mockGetUserById: vi.fn(),
  mockNotifySeen: vi.fn(),
  mockSocketHandlers: {},
  mockSocket: {
    on: vi.fn((event, handler) => {
      mockSocketHandlers[event] = handler;
    }),
    off: vi.fn(),
    emit: vi.fn(),
  },
}));

vi.mock("../src/services/message.service", () => ({
  getConversation: mockGetConversation,
  sendMessage: mockSendMessage,
  editMessage: mockEditMessage,
  deleteMessage: mockDeleteMessage,
  toggleReaction: mockToggleReaction,
}));

vi.mock("../src/services/user.service", () => ({
  getUserById: mockGetUserById,
}));

vi.mock("../src/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, username: "me" } }),
}));

vi.mock("../src/context/SocketContext", () => ({
  useSocket: () => ({ onlineUsers: [], notifySeen: mockNotifySeen }),
}));

vi.mock("../src/services/socket", () => ({
  default: mockSocket,
}));

vi.mock("../src/components/layout/AppShell", () => ({
  default: ({ children }) => <div>{children}</div>,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();

  return { ...actual, useParams: () => ({ id: "2" }) };
});

import Chat from "../src/pages/Chat";

const friendMessage = {
  id: 5,
  senderId: 2,
  receiverId: 1,
  content: "hello there",
  status: "DELIVERED",
  createdAt: "2026-10-22T10:00:00.000Z",
  replyTo: null,
  reactions: [],
};

const myMessage = {
  id: 6,
  senderId: 1,
  receiverId: 2,
  content: "hi back",
  status: "READ",
  createdAt: "2026-10-22T10:01:00.000Z",
  replyTo: null,
  reactions: [],
};

const renderChat = () =>
  render(
    <MemoryRouter>
      <Chat />
    </MemoryRouter>,
  );

beforeEach(() => {
  mockGetConversation.mockResolvedValue([friendMessage, myMessage]);
  mockGetUserById.mockResolvedValue({ id: 2, username: "friend" });
  mockSendMessage.mockResolvedValue({
    data: { ...myMessage, id: 7, content: "my answer" },
  });
  mockToggleReaction.mockResolvedValue({
    data: {
      messageId: 5,
      reactions: [{ id: 1, userId: 1, emoji: "👍" }],
      mine: "👍",
    },
  });

  Object.keys(mockSocketHandlers).forEach((key) => delete mockSocketHandlers[key]);
});

afterEach(() => {
  cleanup();
});

describe("Chat replies and reactions", () => {
  it("sends a message as a reply to the selected message", async () => {
    renderChat();

    await screen.findByText("hello there");

    fireEvent.click(screen.getByText("hello there"));
    fireEvent.click(screen.getByLabelText("Reply to this message"));

    expect(screen.getByText(/Replying to/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "my answer" },
    });

    fireEvent.click(screen.getByLabelText("Send message"));

    expect(mockSendMessage).toHaveBeenCalledWith(2, "my answer", 5);
  });

  it("clears the reply after the message was sent", async () => {
    renderChat();

    await screen.findByText("hello there");

    fireEvent.click(screen.getByText("hello there"));
    fireEvent.click(screen.getByLabelText("Reply to this message"));

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "my answer" },
    });

    fireEvent.click(screen.getByLabelText("Send message"));

    await screen.findByText("my answer");

    expect(screen.queryByText(/Replying to/i)).not.toBeInTheDocument();
  });

  it("shows the reactions of a message", async () => {
    mockGetConversation.mockResolvedValue([
      {
        ...friendMessage,
        reactions: [
          { id: 1, userId: 2, emoji: "👍" },
          { id: 2, userId: 1, emoji: "👍" },
        ],
      },
    ]);

    renderChat();

    const reaction = await screen.findByLabelText("👍 reaction, 2");

    expect(reaction).toBeInTheDocument();
  });

  it("reacts with an emoji and shows the new count", async () => {
    renderChat();

    await screen.findByText("hello there");

    fireEvent.click(screen.getByText("hello there"));
    fireEvent.click(screen.getByLabelText("React to this message"));
    fireEvent.click(screen.getByLabelText("Emoji 👍"));

    expect(mockToggleReaction).toHaveBeenCalledWith(5, "👍");

    expect(await screen.findByLabelText("👍 reaction, 1")).toBeInTheDocument();
  });

  it("updates the reactions when the server broadcasts a change", async () => {
    renderChat();

    await screen.findByText("hello there");

    act(() => {
      mockSocketHandlers.messageReaction({
        messageId: 5,
        reactions: [{ id: 3, userId: 2, emoji: "🎉" }],
      });
    });

    expect(await screen.findByLabelText("🎉 reaction, 1")).toBeInTheDocument();
  });

  it("shows an incoming message that replies to another message", async () => {
    renderChat();

    await screen.findByText("hello there");

    act(() => {
      mockSocketHandlers.newMessage({
        id: 9,
        senderId: 2,
        receiverId: 1,
        content: "sure, take it",
        status: "DELIVERED",
        createdAt: "2026-10-22T10:05:00.000Z",
        replyTo: {
          id: 6,
          senderId: 1,
          content: "hi back",
          deleted: false,
          sender: { username: "me" },
        },
        reactions: [],
      });
    });

    expect(await screen.findByText("sure, take it")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Jump to the message of me"),
    ).toBeInTheDocument();
  });
});
