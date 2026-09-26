import AppShell from "../components/layout/AppShell";
import ChatEmptyState from "../components/chat/ChatEmptyState";

function Home() {
  return (
    <AppShell mobileView="list">
      <ChatEmptyState
        title="Your messages"
        description="Select a conversation from the list, or search for someone new to start chatting."
      />
    </AppShell>
  );
}

export default Home;
