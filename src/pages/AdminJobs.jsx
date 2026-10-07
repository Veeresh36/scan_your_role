import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAdmin } from "../admin/AdminContext";
import { btn, btnD, btnI, btnP, chip, field, IconEdit, IconPlusSm, IconRefresh, IconSearch, IconTrash, panel } from "../admin/ui";

const fmt = (d) => {
  if (!d) return "–";
  const x = new Date(d + "T00:00:00");
  return isNaN(x) ? d : x.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

function Status({ j }) {
  if (!j.deadline) return <span className={chip.ok}>Open</span>;
  const d = new Date(j.deadline + "T23:59:59");
  const days = Math.ceil((d - new Date()) / 864e5);
  const lbl = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  if (days < 0) return <span className={chip.no}>Closed {lbl}</span>;
  if (days <= 3) return <span className={chip.warn}>Closes {lbl}</span>;
  return <span className={chip.ok}>Until {lbl}</span>;
}

const Kpi = ({ label, children, hl }) => (
  <div className={`rounded-xl border px-5 py-[18px] shadow-[var(--sh)] ${hl ? "border-[var(--side)] bg-[var(--side)] text-white" : "border-[var(--line)] bg-[var(--card)]"}`}>
    <span className={`text-[13px] font-semibold ${hl ? "text-[var(--side-ink)]" : "text-[var(--mute)]"}`}>{label}</span>
    {children}
  </div>
);

const Empty = ({ title, children }) => (
  <div className="px-5 py-[34px] text-center text-[var(--mute)]">
    <b className="mb-0.5 block text-[var(--ink)]">{title}</b>
    {children}
  </div>
);

export default function AdminJobs() {
  const { jobs, clicksOf, loadClicks, deleteJob, toast } = useAdmin();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("clicks");
  const [pending, setPending] = useState(null); // job waiting for delete confirmation
  const dlg = useRef(null);

  // fresh click numbers every time this page opens
  useEffect(() => { loadClicks(); }, [loadClicks]);

  // open / close the native confirm dialog
  useEffect(() => {
    const d = dlg.current;
    if (pending && !d.open) d.showModal();
    if (!pending && d.open) d.close();
  }, [pending]);

  const total = jobs.reduce((a, j) => a + clicksOf(j), 0);
  const max = Math.max(1, ...jobs.map(clicksOf));
  const ranked = useMemo(() => [...jobs].sort((a, b) => clicksOf(b) - clicksOf(a)), [jobs, clicksOf]); // eslint-disable-line
  const top = ranked[0];
  const hot = ranked.filter((j) => clicksOf(j) > 0).slice(0, 5);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = jobs.filter((j) => !t || [j.company, j.role, j.location].some((x) => String(x || "").toLowerCase().includes(t)));
    if (sort === "clicks") list.sort((a, b) => clicksOf(b) - clicksOf(a));
    else if (sort === "new") list.sort((a, b) => String(b.posted || "").localeCompare(String(a.posted || "")));
    else list.sort((a, b) => String(a.company).localeCompare(String(b.company)));
    return list;
  }, [jobs, q, sort, clicksOf]);

  const confirmDelete = async () => {
    const id = pending.id;
    setPending(null);
    await deleteJob(id);
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[28px] leading-tight tracking-[-.025em]">Jobs</h1>
          <p className="mb-0 mt-1 text-[var(--mute)]">All listings and how many times visitors clicked Apply.</p>
        </div>
        <Link to="/admin/add" className={`${btn} ${btnP}`}><IconPlusSm size={16} /> Add job</Link>
      </div>

      {/* stats */}
      <div className="mb-[18px] grid grid-cols-1 gap-4 min-[900px]:grid-cols-3">
        <Kpi label="Total jobs"><strong className="mt-0.5 block text-3xl leading-tight tracking-[-.03em]">{jobs.length}</strong></Kpi>
        <Kpi label="Apply clicks" hl><strong className="mt-0.5 block text-3xl leading-tight tracking-[-.03em]">{total}</strong></Kpi>
        <Kpi label="Most clicked">
          <strong className="mt-2 block truncate text-[17px] leading-normal">
            {top && clicksOf(top) > 0 ? `${top.company} – ${top.role}` : "No clicks yet"}
          </strong>
        </Kpi>
      </div>

      {/* chart */}
      <div className={panel}>
        <div className="px-5 pt-[18px]">
          <h2 className="m-0 text-base">Top jobs by clicks</h2>
          <p className="mb-0 mt-0.5 text-[13.5px] text-[var(--mute)]">The five listings people apply to most.</p>
        </div>
        {hot.length ? (
          <div className="grid gap-3 px-5 pb-5 pt-3.5">
            {hot.map((j) => (
              <div key={j.id} className="grid grid-cols-[100px_1fr_40px] items-center gap-3.5 text-[13.5px] min-[900px]:grid-cols-[minmax(120px,260px)_1fr_52px]">
                <span className="truncate font-semibold" title={`${j.company} – ${j.role}`}>{j.company} – {j.role}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--grey-t)]">
                  <i className="block h-full rounded-full bg-[var(--brand)] transition-[width] duration-500" style={{ width: `${Math.max(3, (clicksOf(j) / max) * 100)}%` }} />
                </div>
                <b className="text-right">{clicksOf(j)}</b>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="No apply clicks yet">Clicks appear here when visitors press Apply on a job.</Empty>
        )}
      </div>

      {/* table */}
      <div className={panel}>
        <div className="flex flex-wrap gap-2.5 border-b border-[var(--line)] px-5 py-4">
          <div className="relative min-w-[220px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mute)]"><IconSearch size={16} /></span>
            <input className={`${field} pl-[38px]`} type="search" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search company, role or location" aria-label="Search jobs" />
          </div>
          <select className={`${field} !w-auto min-w-40`} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort jobs">
            <option value="clicks">Most clicks</option>
            <option value="new">Newest first</option>
            <option value="company">Company A–Z</option>
          </select>
          <button type="button" className={btn} onClick={async () => { await loadClicks(); toast("Clicks updated."); }}>
            <IconRefresh size={16} /> Refresh clicks
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {["Job", "Location", "Type", "Posted", "Status", "Clicks"].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-[var(--line)] bg-[#f8fafb] px-5 py-[11px] text-left text-[12.5px] font-bold text-[var(--mute)]">{h}</th>
                ))}
                <th className="border-b border-[var(--line)] bg-[#f8fafb] px-5 py-[11px]"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => (
                <tr key={j.id} className="transition-colors hover:bg-[#f8fafb] [&:last-child>td]:border-b-0">
                  <td className="border-b border-[var(--line)] px-5 py-3.5 align-middle">
                    <b className="block text-[14.5px]">{j.company}</b>
                    <span className="text-[13.5px] text-[var(--mute)]">{j.role}</span>
                  </td>
                  <td className="border-b border-[var(--line)] px-5 py-3.5 align-middle">{j.location}</td>
                  <td className="whitespace-nowrap border-b border-[var(--line)] px-5 py-3.5 align-middle">
                    <span className={chip.brand}>{j.type}</span> <span className={chip.grey}>{j.cat}</span>
                  </td>
                  <td className="whitespace-nowrap border-b border-[var(--line)] px-5 py-3.5 align-middle">{fmt(j.posted)}</td>
                  <td className="border-b border-[var(--line)] px-5 py-3.5 align-middle"><Status j={j} /></td>
                  <td className="border-b border-[var(--line)] px-5 py-3.5 align-middle">
                    <div className="flex min-w-[130px] items-center gap-2.5">
                      <b className="min-w-[30px] text-[15px]">{clicksOf(j)}</b>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--grey-t)]">
                        <i className="block h-full bg-[var(--brand)]" style={{ width: `${(clicksOf(j) / max) * 100}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="border-b border-[var(--line)] px-5 py-3.5 align-middle">
                    <div className="flex justify-end gap-1.5">
                      <button type="button" className={`${btn} ${btnI}`} aria-label={`Edit ${j.company}`} onClick={() => navigate(`/admin/edit/${j.id}`)}>
                        <IconEdit size={16} />
                      </button>
                      <button type="button" className={`${btn} ${btnI} hover:!border-[#efb9b2] hover:!bg-[var(--red-t)] hover:!text-[var(--red)]`}
                        aria-label={`Delete ${j.company}`} onClick={() => setPending(j)}>
                        <IconTrash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={7}>
                    <Empty title={jobs.length ? "No jobs match your search" : "No jobs yet"}>
                      {jobs.length ? "Try a different word." : "Use Add job to publish the first listing."}
                    </Empty>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[var(--line)] bg-[#f8fafb] px-5 py-3 text-[13px] text-[var(--mute)]">
          Showing {rows.length} of {jobs.length} jobs
        </div>
      </div>

      {/* delete confirmation */}
      <dialog ref={dlg} onClose={() => setPending(null)}
        className="m-auto w-[min(420px,92vw)] rounded-2xl border-0 p-[26px] shadow-[0_24px_70px_rgba(15,36,48,.3)] backdrop:bg-[rgba(15,36,48,.5)]">
        <h3 className="mb-1.5 mt-0 text-lg">Delete this job?</h3>
        <p className="mb-5 mt-0 text-[var(--mute)]">
          {pending ? `${pending.company} – ${pending.role} will be removed from the website straight away.` : ""}
        </p>
        <div className="flex justify-end gap-2.5">
          <button type="button" className={btn} onClick={() => setPending(null)}>Keep job</button>
          <button type="button" className={`${btn} ${btnD}`} onClick={confirmDelete}>Delete job</button>
        </div>
      </dialog>
    </>
  );
}
