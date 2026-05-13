function Navbar({ pageTitle, collapsed, onMenuClick, onCollapseClick }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/70 bg-white/75 px-4 backdrop-blur-xl sm:px-5 lg:px-8">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 text-slate-700 shadow-sm lg:hidden"
            aria-label="Open navigation"
            onClick={onMenuClick}
          >
            <span className="text-xl leading-none">&#9776;</span>
          </button>

          <button
            type="button"
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 text-slate-500 shadow-sm hover:bg-slate-50 lg:flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onCollapseClick}
          >
            <span className="text-lg leading-none">{collapsed ? "\u203a" : "\u2039"}</span>
          </button>

          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-500">AI Lead Generation MVP</p>
            <h1 className="truncate text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">
              {pageTitle}
            </h1>
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          MVP Live
        </div>
      </div>
    </header>
  );
}

export default Navbar;
