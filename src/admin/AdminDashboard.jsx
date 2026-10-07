import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdmin } from "./AdminContext";
import { btn, btnP, chip, panel, IconPlus, IconList } from "./ui";

/* ---------- helpers (same rules as the public site) ---------- */
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const DAY = 864e5;
const isGovt = (j) =>
    j.sector
        ? /gov|psu|public|sarkari/i.test(j.sector)
        : /\bgovt\b|government|sarkari/i.test(j.company || "");
const fmtDate = (d) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
// "karnataka", "Karnataka " and "KARNATAKA" all become "Karnataka"
const tidyLoc = (s) =>
    String(s || "").trim().replace(/\s+/g, " ").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const tally = (arr, fn) => {
    const m = {};
    arr.forEach((x) => { const k = fn(x) || "Not set"; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
};
// reads the admin token the same way the rest of the admin does
const getToken = () => {
    try {
        for (const s of [localStorage, sessionStorage])
            for (let i = 0; i < s.length; i++) {
                const k = s.key(i);
                if (/token/i.test(k)) return s.getItem(k);
            }
    } catch { }
    return "";
};

/* ---------- small pieces ---------- */
function Stat({ label, value, hint, tone }) {
    const color = { warn: "text-[var(--amber)]", no: "text-[var(--red)]", ok: "text-[var(--green)]" }[tone] || "text-[var(--ink)]";
    return (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 shadow-[var(--sh)]">
            <div className="text-[13px] font-semibold text-[var(--mute)]">{label}</div>
            <div className={`mt-2 text-[2rem] font-extrabold leading-none tracking-[-.02em] tabular-nums ${color}`}>{value}</div>
            <div className="mt-2 text-xs text-[var(--faint)]">{hint}</div>
        </div>
    );
}

function Panel({ title, action, children }) {
    return (
        <section className={`${panel} !mb-0`}>
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
                <h2 className="m-0 text-sm font-bold">{title}</h2>
                {action}
            </div>
            {children}
        </section>
    );
}

function Empty({ children }) {
    return <p className="m-0 px-5 py-8 text-center text-sm text-[var(--mute)]">{children}</p>;
}

function JobLine({ j, right }) {
    return (
        <li className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3 last:border-b-0">
            <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{j.role}</div>
                <div className="truncate text-[13px] text-[var(--mute)]">{j.company} · {j.location}</div>
            </div>
            {right}
        </li>
    );
}

function Bars({ rows, total }) {
    if (!rows.length) return <Empty>No data yet.</Empty>;
    return (
        <ul className="m-0 grid list-none gap-3 p-5">
            {rows.map(([label, n]) => (
                <li key={label}>
                    <div className="mb-1 flex justify-between text-[13px]">
                        <span className="truncate font-semibold">{label}</span>
                        <span className="tabular-nums text-[var(--mute)]">{n}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--grey-t)]">
                        <div className="h-full rounded-full [background-image:var(--grad)]" style={{ width: `${Math.max(4, (n / total) * 100)}%` }} />
                    </div>
                </li>
            ))}
        </ul>
    );
}

/* ---------- page ---------- */
export default function AdminDashboard() {
    const { jobs = [], token } = useAdmin();
    const [clicks, setClicks] = useState({}); // { jobId: number of unique visitors who pressed Apply }

    useEffect(() => {
        const t = token || getToken();
        if (!t) return;
        fetch("/api/clicks", { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" })
            .then((r) => (r.ok ? r.json() : {}))
            .then(setClicks)
            .catch(() => { });
    }, [token]);

    const d = useMemo(() => {
        const t = today();
        const left = (j) => Math.ceil((new Date(j.deadline) - t) / DAY);
        const expired = jobs.filter((j) => j.deadline && new Date(j.deadline) < t);
        const live = jobs.filter((j) => !expired.includes(j));
        const closing = live
            .filter((j) => j.deadline && left(j) <= 7)
            .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
        const recent = [...jobs].sort((a, b) => new Date(b.posted) - new Date(a.posted));
        const thisWeek = jobs.filter((j) => j.posted && (t - new Date(j.posted)) / DAY <= 7).length;
        const noLink = live.filter((j) => !j.link);
        const noDeadline = live.filter((j) => !j.deadline);

        const clickOf = (j) => clicks[j.id] || 0;
        const totalClicks = jobs.reduce((s, j) => s + clickOf(j), 0);
        const topClicked = jobs
            .filter((j) => clickOf(j) > 0)
            .sort((a, b) => clickOf(b) - clickOf(a))
            .slice(0, 6);

        return {
            t, left, expired, live, closing, recent, thisWeek, noLink, noDeadline,
            clickOf, totalClicks, topClicked,
            govt: live.filter(isGovt).length,
            pvt: live.filter((j) => !isGovt(j)).length,
            cats: tally(live, (j) => j.cat).slice(0, 6),
            locs: tally(live, (j) => tidyLoc(j.location)).slice(0, 6),
            exp: tally(live, (j) => (j.exp === "fresher" ? "Freshers" : j.exp === "exp" ? "Experienced" : "")),
        };
    }, [jobs, clicks]);

    const attention = d.expired.length + d.noLink.length;

    return (
        <div className="mx-auto max-w-[1200px]">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="m-0 text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-[-.02em]">Dashboard</h1>
                    <p className="m-0 mt-1 text-sm text-[var(--mute)]">
                        {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link to="/admin/jobs" className={btn}><IconList size={16} /> View jobs</Link>
                    <Link to="/admin/add" className={`${btn} ${btnP}`}><IconPlus size={16} /> Add job</Link>
                </div>
            </div>

            {/* Stats */}
            <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-6">
                <Stat label="Total jobs" value={jobs.length} hint="Everything in jobs.json" />
                <Stat label="Live now" value={d.live.length} hint={`${d.govt} govt · ${d.pvt} private`} tone="ok" />
                <Stat label="Closing in 7 days" value={d.closing.length} hint="Check these first" tone={d.closing.length ? "warn" : undefined} />
                <Stat label="Expired" value={d.expired.length} hint="Safe to remove" tone={d.expired.length ? "no" : undefined} />
                <Stat label="Added this week" value={d.thisWeek} hint="Last 7 days" />
                <Stat label="Apply clicks" value={d.totalClicks} hint="Unique visitors, all jobs" tone="ok" />
            </div>

            {/* Lists */}
            <div className="mb-5 grid gap-5 lg:grid-cols-2">
                <Panel title="Closing soon" action={<span className={chip.warn}>{d.closing.length}</span>}>
                    {d.closing.length ? (
                        <ul className="m-0 list-none p-0">
                            {d.closing.slice(0, 6).map((j, i) => {
                                const n = d.left(j);
                                return (
                                    <JobLine key={j.company + j.role + i} j={j}
                                        right={<span className={n <= 1 ? chip.no : chip.warn}>{n === 0 ? "Last day" : `${n} day${n > 1 ? "s" : ""} left`}</span>} />
                                );
                            })}
                        </ul>
                    ) : <Empty>No job closes in the next 7 days.</Empty>}
                </Panel>

                <Panel title="Recently added" action={<Link to="/admin/jobs" className="text-[13px] font-semibold text-[var(--brand)] no-underline hover:underline">See all</Link>}>
                    {d.recent.length ? (
                        <ul className="m-0 list-none p-0">
                            {d.recent.slice(0, 6).map((j, i) => (
                                <JobLine key={j.company + j.role + i} j={j}
                                    right={<span className="whitespace-nowrap text-xs text-[var(--faint)]">{j.posted ? fmtDate(j.posted) : "—"}</span>} />
                            ))}
                        </ul>
                    ) : <Empty>No jobs yet. Add your first one.</Empty>}
                </Panel>
            </div>

            {/* Most clicked */}
            <div className="mb-5">
                <Panel title="Most clicked jobs" action={<span className={chip.ok}>{d.totalClicks} clicks</span>}>
                    {d.topClicked.length ? (
                        <ul className="m-0 list-none p-0">
                            {d.topClicked.map((j) => (
                                <JobLine key={j.id} j={j}
                                    right={<span className={chip.ok}>{d.clickOf(j)} click{d.clickOf(j) > 1 ? "s" : ""}</span>} />
                            ))}
                        </ul>
                    ) : <Empty>No Apply clicks yet. They appear here once visitors press Apply.</Empty>}
                </Panel>
            </div>

            {/* Breakdowns */}
            <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <Panel title="By category"><Bars rows={d.cats} total={d.live.length || 1} /></Panel>
                <Panel title="By location"><Bars rows={d.locs} total={d.live.length || 1} /></Panel>
                <Panel title="By experience"><Bars rows={d.exp} total={d.live.length || 1} /></Panel>
                <Panel title="By sector">
                    <Bars rows={[["Government", d.govt], ["Private", d.pvt]]} total={d.live.length || 1} />
                </Panel>
            </div>

            {/* Needs attention */}
            <Panel title="Needs attention" action={<span className={attention ? chip.no : chip.ok}>{attention ? attention : "All good"}</span>}>
                {attention + d.noDeadline.length === 0 ? (
                    <Empty>Nothing to fix. Every live job has an apply link and a last date.</Empty>
                ) : (
                    <ul className="m-0 grid list-none gap-2.5 p-5 text-sm">
                        {d.expired.length > 0 && (
                            <li><span className={chip.no}>{d.expired.length} expired</span> <span className="ml-2 text-[var(--mute)]">still listed on the site. Remove them from View jobs.</span></li>
                        )}
                        {d.noLink.length > 0 && (
                            <li><span className={chip.no}>{d.noLink.length} no apply link</span> <span className="ml-2 text-[var(--mute)]">visitors cannot apply to these.</span></li>
                        )}
                        {d.noDeadline.length > 0 && (
                            <li><span className={chip.grey}>{d.noDeadline.length} no last date</span> <span className="ml-2 text-[var(--mute)]">these never show a countdown or expire on their own.</span></li>
                        )}
                    </ul>
                )}
            </Panel>
        </div>
    );
}