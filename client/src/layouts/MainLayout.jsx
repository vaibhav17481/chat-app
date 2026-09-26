function MainLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto min-h-screen max-w-[1600px]">
        {children}
      </div>
    </div>
  );
}

export default MainLayout;