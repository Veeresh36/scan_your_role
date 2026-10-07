import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AdminProvider, useAdmin } from "./AdminContext";
import AdminLogin from "./AdminLogin";
import { ADMIN_CSS, IconDash, IconList, IconLogout, IconPlus, IconTag, Mark } from "./ui";
import { Logo } from "../Brand";
import { SITE_NAME } from "../site";

const navCls = (on) =>
  `flex items-center gap-3 whitespace-nowrap rounded-[10px] px-3 py-[11px] text-left text-sm font-semibold no-underline transition min-[900px]:w-full ${
    on
      ? "text-white shadow-[0_8px_20px_-10px_var(--brand)] [background-image:var(--grad)]"
      : "text-[var(--side-ink)] hover:bg-[var(--side-hi)] hover:text-white"
  }`;

function Shell() {
  const { status, jobs, logout, toasts } = useAdmin();
  const { pathname } = useLocation();

  // keep the admin out of search engines
  useEffect(() => {
    document.title = `${SITE_NAME} Admin`;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  // scroll to top when switching between admin pages
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);

  if (status === "boot") {
    return (
      <div role="status" aria-live="polite"
        className="grid min-h-screen place-content-center gap-3.5 bg-[var(--bg)] text-center font-semibold text-[var(--mute)]">
        <div className="admin-spin mx-auto h-10 w-10 rounded-full border-4 border-[var(--brand-t)] border-t-[var(--brand)]" />
        Loading admin…
      </div>
    );
  }

  if (status === "locked") return <AdminLogin />;

  const addActive = pathname.startsWith("/admin/add") || pathname.startsWith("/admin/edit");

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[15px] leading-[1.55] text-[var(--ink)] min-[900px]:grid min-[900px]:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="flex items-center gap-1.5 overflow-x-auto bg-[var(--side)] px-3 py-2.5 text-[var(--side-ink)] min-[900px]:sticky min-[900px]:top-0 min-[900px]:h-screen min-[900px]:flex-col min-[900px]:items-stretch min-[900px]:overflow-visible min-[900px]:px-3.5 min-[900px]:py-[22px]">
        {/* Same logo as the public site. Text is forced white for the dark sidebar. */}
        <div className="flex items-center pr-2.5 min-[900px]:px-2.5 min-[900px]:pb-[22px] min-[900px]:pr-0 [--ink:#fff]">
          <span className="min-[900px]:hidden"><Mark /></span>
          <span className="max-[899px]:hidden text-white"><Logo size={34} text="text-[17px]" /></span>
        </div>

        <NavLink to="/admin" end className={({ isActive }) => navCls(isActive)}><IconDash /> Dashboard</NavLink>
        <NavLink to="/admin/add" className={navCls(addActive)}><IconPlus /> Add job</NavLink>
        <NavLink to="/admin/jobs" className={({ isActive }) => navCls(isActive)}>
          <IconList /> View jobs
          <span className="ml-auto rounded-full bg-white/15 px-2 text-xs leading-5 tabular-nums text-white">{jobs.length}</span>
        </NavLink>
        <NavLink to="/admin/affiliates" className={({ isActive }) => navCls(isActive)}>
          <IconTag /> Affiliates
        </NavLink>

        <div className="flex-1 max-[899px]:hidden" />
        <div className="ml-auto min-[900px]:ml-0 min-[900px]:mt-2 min-[900px]:border-t min-[900px]:border-white/10 min-[900px]:pt-3">
          <button type="button" onClick={logout} className={`${navCls(false)} border-0 bg-transparent`}>
            <IconLogout /> Log out
          </button>
        </div>
      </aside>

      <main className="min-w-0 px-[clamp(20px,3.2vw,56px)] pb-28 pt-[30px]">
        <Outlet />
      </main>

      <div aria-live="polite" className="fixed right-6 top-6 z-[80] grid gap-2.5">
        {toasts.map((t) => (
          <div key={t.id}
            className={`toast-in max-w-[360px] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-[0_10px_30px_rgba(15,36,48,.25)] ${t.bad ? "bg-[var(--red)]" : "bg-[var(--side)]"}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <div className="admin">
      <style>{ADMIN_CSS}</style>
      <AdminProvider>
        <Shell />
      </AdminProvider>
    </div>
  );
}