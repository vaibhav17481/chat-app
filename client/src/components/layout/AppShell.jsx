import Sidebar from "./Sidebar";

/**
 * mobileView: "list" | "detail"
 *  - "list": on small screens show only the sidebar (chat list). Used on /home.
 *  - "detail": on small screens show only the children (active chat). Used on /chat/:id.
 * At the lg breakpoint both panes are always shown side by side.
 */
function AppShell({ children, activeId, mobileView = "list" }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-ink">
      <Sidebar
        activeId={activeId}
        className={mobileView === "detail" ? "hidden lg:flex" : "flex"}
      />

      <div
        className={`min-w-0 flex-1 ${
          mobileView === "list" ? "hidden lg:flex" : "flex"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export default AppShell;
