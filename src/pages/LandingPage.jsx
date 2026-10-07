import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { trackClick } from "../track";
import { SITE_NAME, INSTAGRAM_HANDLE, INSTAGRAM_URL, WHATSAPP_URL } from "../site";
import { Logo } from "../Brand";
import NotifyButton from "../NotifyButton.jsx";

/* ------------------------------------------------------------------ */
/* Data + helpers                                                      */
/* ------------------------------------------------------------------ */
const FALLBACK = [
    {
        company: "Sasken",
        role: "Software Engineer in Testing",
        sector: "Private",
        cat: "Tech",
        type: "Full-Time",
        location: "Bangalore",
        eligibility: "Engineering and MCA graduates (freshers)",
        experience: "0–2 years",
        exp: "fresher",
        posted: "2026-10-01",
        deadline: "",
        link: "https://www.hirewand.com/apply/job/detail?jid=20221077&sid=603c97cc12823e2c17d5185a&cpid=2022&uid=147403&src=jobpost",
    },
];

const STEPS = [
    ["Search and filter", "Choose Government or Private, then narrow by category, experience, job type or city."],
    ["Read the details", "Open a job to see eligibility, the last date and how to apply."],
    ["Apply on the official page", "Every Apply button opens the company's own form. Never pay to get a job."],
];

const POSTED = [
    ["all", "Any time"],
    ["3", "Last 3 days"],
    ["7", "Last 7 days"],
    ["30", "Last 30 days"],
];

const PAGE = 10;

// Treat YYYY-MM-DD as a local calendar date, not UTC (same rule as the job page).
const toLocalDate = (value) => {
    if (!value) return null;
    const str = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [y, m, d] = str.split("-").map(Number);
        return new Date(y, m - 1, d);
    }
    const date = new Date(str);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
};

const today = new Date();
today.setHours(0, 0, 0, 0);

const daysAgo = (d) => {
    const x = toLocalDate(d);
    return x ? Math.floor((today - x) / 864e5) : 99999;
};
const isExpired = (j) => {
    const d = toLocalDate(j.deadline);
    return Boolean(d && d < today);
};
const isNew = (j) => daysAgo(j.posted) <= 7 && !isExpired(j);
const slug = (j) =>
    `${j.company}-${j.role}-${j.posted}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const jobUrl = (j) => `/job?id=${slug(j)}`;
const sectorOf = (j) =>
    j.sector
        ? /gov|psu|public|sarkari/i.test(j.sector) ? "govt" : "private"
        : /\bgovt\b|government|sarkari/i.test(j.company || "") ? "govt" : "private";
const isGovt = (j) => sectorOf(j) === "govt";
const fmtDate = (d) => {
    const x = toLocalDate(d);
    return x ? x.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
};
const vacLabel = (v) => (/^\d+$/.test(String(v).trim()) ? `${v} vacancies` : String(v));
const vacNum = (j) => parseInt(String(j.vacancies || "").replace(/[^\d]/g, ""), 10) || 0;
const hue = (c) => {
    let h = 0;
    for (const ch of c) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
};
const monoStyle = (c) => {
    const h = hue(c);
    return { background: `hsl(${h} 85% 93%)`, color: `hsl(${h} 55% 34%)` };
};
const expText = (j) => (String(j.experience).trim() === "0" ? "Freshers (0 years)" : j.experience || "Not specified");
const initials = (c) =>
    c.replace(/[^A-Za-z0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "J";
const ago = (d) => {
    const n = daysAgo(d);
    if (n > 3650) return "Posted recently";
    return n <= 0 ? "Posted today" : n === 1 ? "Posted yesterday" : `Posted ${n} days ago`;
};
const closing = (j) => {
    const d = toLocalDate(j.deadline);
    if (!d) return null;
    const n = Math.round((d.getTime() - today.getTime()) / 864e5);
    if (n < 0) return null;
    if (n === 0) return { t: "Last day", late: true };
    return { t: `${n} day${n > 1 ? "s" : ""} left`, late: n <= 3 };
};
// "karnataka", "Karnataka " and "KARNATAKA" all become "Karnataka"
const tidyLoc = (s) =>
    String(s || "").trim().replace(/\s+/g, " ").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
// _h is one lowercase string with everything a person might type, built once per job
const cleanJobs = (arr) =>
    arr.map((j) => {
        const job = { ...j, location: tidyLoc(j.location) };
        job._h = [
            job.company, job.role, job.location, job.type, job.cat, job.eligibility, job.skills, job.salary, job.vacancies,
            sectorOf(job) === "govt" ? "government govt sarkari" : "private",
            job.exp === "fresher" ? "fresher freshers" : "experienced",
        ].filter(Boolean).join(" ").toLowerCase();
        return job;
    });

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const tokensOf = (q) => q.trim().toLowerCase().split(/\s+/).filter(Boolean);

/* ------------------------------------------------------------------ */
/* Filters live in the URL, so Back from a job page keeps your search  */
/* ------------------------------------------------------------------ */
const DEFAULTS = { q: "", sector: "all", cat: "all", exp: "all", type: "all", loc: "all", posted: "all", closed: false, saved: false };
const KEYS = { q: "q", sector: "s", cat: "c", exp: "e", type: "t", loc: "l", posted: "p", closed: "closed", saved: "saved" };
const FILTER_KEYS = ["cat", "exp", "type", "loc", "posted", "closed"];

const fromParams = (sp) => {
    const f = { ...DEFAULTS };
    Object.keys(KEYS).forEach((k) => {
        const v = sp.get(KEYS[k]);
        if (v !== null) f[k] = typeof DEFAULTS[k] === "boolean" ? v === "1" : v;
    });
    return f;
};
const toParams = (f) => {
    const sp = new URLSearchParams();
    Object.keys(KEYS).forEach((k) => {
        if (f[k] !== DEFAULTS[k]) sp.set(KEYS[k], typeof DEFAULTS[k] === "boolean" ? "1" : f[k]);
    });
    return sp;
};

// one job against every active filter. `skip` leaves one filter out, which is how facet counts stay honest.
const passes = (j, f, tk, skip, savedSet) =>
    (skip === "sector" || f.sector === "all" || sectorOf(j) === f.sector) &&
    (skip === "cat" || f.cat === "all" || j.cat === f.cat) &&
    (skip === "exp" || f.exp === "all" || j.exp === f.exp) &&
    (skip === "type" || f.type === "all" || j.type === f.type) &&
    (skip === "loc" || f.loc === "all" || j.location === f.loc) &&
    (skip === "posted" || f.posted === "all" || daysAgo(j.posted) <= Number(f.posted)) &&
    (!f.saved || savedSet.has(slug(j))) &&
    tk.every((t) => j._h.includes(t));

const relevance = (j, tk) => {
    const role = String(j.role || "").toLowerCase();
    const co = String(j.company || "").toLowerCase();
    return tk.reduce((s, t) => s + (role.includes(t) ? 3 : 0) + (co.includes(t) ? 2 : 0) + (String(j.location).toLowerCase().includes(t) ? 1 : 0) + (String(j.cat || "").toLowerCase().includes(t) ? 1 : 0), 0);
};

/* small localStorage helpers that never throw */
const readList = (key) => {
    try {
        const v = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(v) ? v : [];
    } catch { return []; }
};
const writeList = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { } };

/* ------------------------------------------------------------------ */
/* Design tokens                                                       */
/* ------------------------------------------------------------------ */
const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap");
:root{
  --bg:#f6f7fb;--surface:#fff;--sunken:#eef0f7;--ink:#0b1220;--mute:#5b677f;--faint:#8b95ab;--line:#e5e8f0;--line2:#d3d8e6;
  --brand:#4f46e5;--brand2:#2563eb;--bi:#fff;--brand-ink:#fff;--soft:#f0f2ff;--brand-soft:#f0f2ff;--gold:#4f46e5;
  --ok:#047857;--okbg:#dcfce7;--warn:#b45309;--warnbg:#fef3c7;--bad:#b91c1c;--badbg:#fee2e2;
  --ease:cubic-bezier(.22,1,.36,1);
  --sh1:0 1px 2px rgba(11,18,32,.04),0 8px 24px -14px rgba(11,18,32,.12);
  --sh2:0 2px 6px rgba(11,18,32,.06),0 22px 44px -18px rgba(79,70,229,.32);
}
:root[data-theme="dark"]{
  --bg:#080b12;--surface:#10151f;--sunken:#0c1019;--ink:#eef1f8;--mute:#a3adc2;--faint:#6c7690;--line:#212939;--line2:#2d3648;
  --brand:#8c8fff;--brand2:#6ea0ff;--bi:#0a0d14;--brand-ink:#0a0d14;--soft:#192038;--brand-soft:#192038;--gold:#8c8fff;
  --ok:#4ade80;--okbg:#10301f;--warn:#fbbf24;--warnbg:#3a2a0a;--bad:#f87171;--badbg:#3a1414;
  --sh1:0 1px 2px rgba(0,0,0,.4),0 10px 28px -14px rgba(0,0,0,.75);
  --sh2:0 2px 6px rgba(0,0,0,.5),0 22px 44px -18px rgba(140,143,255,.34);
}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%;overflow-x:clip}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow-x:clip;-webkit-tap-highlight-color:transparent}
.serif{font-family:inherit;font-weight:800}
::selection{background:var(--brand);color:var(--brand-ink)}
:focus-visible{outline:2px solid var(--brand);outline-offset:2px;border-radius:8px}
button,a,input,select{touch-action:manipulation}
@keyframes rise{from{opacity:0;transform:translate3d(0,12px,0)}to{opacity:1;transform:none}}
@keyframes fi{from{opacity:0}to{opacity:1}}
@keyframes shimmer{to{background-position:-200% 0}}
@keyframes ping{75%,100%{transform:scale(2.2);opacity:0}}
@keyframes sheet{from{transform:translate3d(0,100%,0)}to{transform:none}}
@keyframes drift{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(40px,30px,0) scale(1.1)}}
@keyframes pop{0%{transform:scale(.7)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
.rise{opacity:0;animation:rise .5s var(--ease) forwards;animation-delay:var(--d,0s)}
.fi{animation:fi .25s ease-out both}
.sheet{animation:sheet .35s var(--ease) both}
.pop{animation:pop .35s var(--ease)}
@keyframes chipIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:none}}
.chipin{animation:chipIn .28s var(--ease) both}
.live{position:relative}
.live::after{content:"";position:absolute;inset:0;border-radius:999px;background:#22c55e;animation:ping 2s cubic-bezier(0,0,.2,1) infinite}
.sk{background:linear-gradient(90deg,var(--sunken) 0,var(--line) 50%,var(--sunken) 100%);background-size:200% 100%;animation:shimmer 1.4s infinite}
.noscroll{scrollbar-width:none}.noscroll::-webkit-scrollbar{display:none}
.grain{background-image:radial-gradient(color-mix(in srgb,var(--ink) 14%,transparent) 1px,transparent 1.2px);background-size:22px 22px;-webkit-mask-image:radial-gradient(70% 80% at 70% 0%,#000,transparent 75%);mask-image:radial-gradient(70% 80% at 70% 0%,#000,transparent 75%)}
.blob{animation:drift 16s ease-in-out infinite alternate;will-change:transform}
/* frosted bars: blur only on large screens (expensive on phones) */
.glass{background:color-mix(in srgb,var(--bg) 97%,transparent)}
@media (min-width:1024px){.glass{background:color-mix(in srgb,var(--bg) 86%,transparent);-webkit-backdrop-filter:saturate(1.3) blur(14px);backdrop-filter:saturate(1.3) blur(14px)}}
@media (max-width:639px){.blob{animation:none}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}.rise{opacity:1!important}}
`;

/* ------------------------------------------------------------------ */
/* Style helpers                                                       */
/* ------------------------------------------------------------------ */
const wrap = "mx-auto w-full max-w-[1200px] px-4 sm:px-8";
const btn =
    "inline-flex min-h-[42px] cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--line2)] bg-[var(--surface)] px-4 text-[13.5px] font-semibold text-[var(--ink)] no-underline transition duration-200 hover:border-[var(--ink)] active:scale-[.97]";
const btnDark = "!border-[var(--ink)] !bg-[var(--ink)] !text-[var(--bg)] hover:!opacity-90";
const btnBrand =
    "!border-transparent !text-[var(--bi)] shadow-[0_8px_20px_-8px_var(--brand)] [background-image:linear-gradient(135deg,var(--brand),var(--brand2))] hover:!text-[var(--bi)] hover:brightness-110";
const selectCls =
    "min-h-[40px] cursor-pointer rounded-lg border border-[var(--line2)] bg-[var(--surface)] px-3 text-[13.5px] font-semibold text-[var(--ink)]";
const gradBg = { backgroundImage: "linear-gradient(135deg,var(--brand),var(--brand2))" };

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */
const Ico = ({ children, size = 15, className = "", fill = "none" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`flex-none ${className}`}>
        {children}
    </svg>
);
const IPin = () => <Ico><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></Ico>;
const ICap = () => <Ico><path d="m2 9 10-5 10 5-10 5z" /><path d="M6 11v5c3 2.5 9 2.5 12 0v-5" /></Ico>;
const IBag = () => <Ico><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></Ico>;
const IClock = () => <Ico size={13}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Ico>;
const ISearch = ({ size = 18 }) => <Ico size={size}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Ico>;
const IArrow = () => <Ico size={15}><path d="M5 12h14M13 6l6 6-6 6" /></Ico>;
const IInfo = () => <Ico size={17}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Ico>;
const IX = ({ size = 13 }) => <Ico size={size}><path d="M18 6 6 18M6 6l12 12" /></Ico>;
const IFilter = () => <Ico><path d="M3 5h18M6 12h12M10 19h4" /></Ico>;
const IUsers = () => <Ico><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.4c1.8.8 3 2.7 3 5.6" /></Ico>;
const IWallet = () => <Ico><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M16 15h2" /></Ico>;
const IShield = ({ size = 16 }) => <Ico size={size}><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" /><path d="m9 12 2 2 4-4" /></Ico>;
const IBookmark = ({ on, size = 18 }) => <Ico size={size} fill={on ? "currentColor" : "none"}><path d="M6 3h12v18l-6-4-6 4z" /></Ico>;
const IHistory = () => <Ico size={14}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></Ico>;
const ITag = () => <Ico><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></Ico>;
const ICheck = () => <Ico size={15}><path d="m5 12 5 5 9-10" /></Ico>;
const IUp = () => <Ico size={18}><path d="M12 19V5M5 12l7-7 7 7" /></Ico>;
const IInsta = ({ size = 18 }) => (
    <Ico size={size}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r=".6" fill="currentColor" />
    </Ico>
);
const IWhatsApp = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="flex-none">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
);

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */
const Mono = ({ company, className = "h-12 w-12 text-[15px]" }) => (
    <div aria-hidden="true" style={monoStyle(company)}
        className={`grid flex-none place-items-center rounded-xl font-extrabold tracking-[-.02em] ${className}`}>
        {initials(company)}
    </div>
);

const Tag = ({ tone = "ok", children }) => {
    const c = {
        ok: "bg-[var(--okbg)] text-[var(--ok)]",
        warn: "bg-[var(--warnbg)] text-[var(--warn)]",
        bad: "bg-[var(--badbg)] text-[var(--bad)]",
        gov: "bg-[var(--soft)] text-[var(--brand)]",
        pvt: "bg-[var(--sunken)] text-[var(--mute)]",
    }[tone];
    return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-[3px] text-[11.5px] font-semibold ${c}`}>{children}</span>;
};

/** Wraps the words you searched for in a soft highlight. */
function Hl({ text, tk }) {
    if (!tk.length || !text) return <>{text}</>;
    const re = new RegExp(`(${tk.map(esc).join("|")})`, "ig");
    return (
        <>
            {String(text).split(re).map((p, i) =>
                i % 2 ? <mark key={i} className="rounded bg-[color-mix(in_srgb,var(--brand)_22%,transparent)] px-0.5 text-inherit">{p}</mark> : p
            )}
        </>
    );
}

function CountUp({ to }) {
    const [n, setN] = useState(0);
    useEffect(() => {
        if (!to || window.matchMedia("(prefers-reduced-motion:reduce)").matches) { setN(to); return; }
        let raf;
        const t0 = performance.now();
        const f = (t) => {
            const p = Math.min((t - t0) / 800, 1);
            setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
            if (p < 1) raf = requestAnimationFrame(f);
        };
        raf = requestAnimationFrame(f);
        return () => cancelAnimationFrame(raf);
    }, [to]);
    return <>{n}</>;
}

/**
 * Search box with suggestions. Type a role, company, city or category and pick from the list,
 * or press Enter. With an empty box it shows recent and popular searches.
 */
function SearchBox({ id, value, onChange, onSubmit, index, recent, popular, onClearRecent, placeholder, onFocusChange, variant = "hero" }) {
    const [open, setOpen] = useState(false);
    const [hi, setHi] = useState(-1);
    const listId = `${id}-list`;

    const items = useMemo(() => {
        const v = value.trim().toLowerCase();
        if (!v) return [...recent.map((label) => ({ label, kind: "Recent" })), ...popular];
        return index
            .filter((i) => i.label.toLowerCase().includes(v))
            .sort((a, b) => Number(b.label.toLowerCase().startsWith(v)) - Number(a.label.toLowerCase().startsWith(v)))
            .slice(0, 7);
    }, [value, index, recent, popular]);

    useEffect(() => { setHi(-1); }, [value]);

    const choose = (it) => {
        onChange(it.label);
        setOpen(false);
        onSubmit(it.label);
    };

    const onKey = (e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => (items.length ? (h + 1) % items.length : -1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => (items.length ? (h <= 0 ? items.length - 1 : h - 1) : -1)); }
        else if (e.key === "Escape") { setOpen(false); }
        else if (e.key === "Enter" && open && hi >= 0 && items[hi]) { e.preventDefault(); choose(items[hi]); }
    };

    const hero = variant === "hero";
    const showList = open && items.length > 0;
    let lastKind = "";

    return (
        <form role="search" onSubmit={(e) => { e.preventDefault(); setOpen(false); onSubmit(value); }}
            className={`relative flex items-center gap-2 border bg-[var(--surface)] transition focus-within:border-[var(--brand)] ${hero
                ? "max-w-[640px] rounded-2xl border-[var(--line2)] py-1.5 pl-4 pr-1.5 shadow-[var(--sh2)]"
                : "min-w-0 flex-1 rounded-xl border-[var(--line2)] py-0.5 pl-3 pr-1"}`}>
            <span className="text-[var(--faint)]"><ISearch size={hero ? 18 : 17} /></span>
            <input id={id} type="text" inputMode="search" enterKeyHint="search" value={value}
                role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
                aria-activedescendant={hi >= 0 ? `${id}-opt-${hi}` : undefined}
                onChange={(e) => { onChange(e.target.value); setOpen(true); }}
                onFocus={() => { setOpen(true); onFocusChange?.(true); }}
                onBlur={() => { setOpen(false); onFocusChange?.(false); }}
                onKeyDown={onKey}
                placeholder={placeholder} aria-label="Search jobs by role, company, city or category" autoComplete="off" spellCheck="false"
                className={`min-w-0 flex-1 border-0 bg-transparent px-1 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)] ${hero ? "py-3" : "py-2.5"}`} />
            {value && (
                <button type="button" aria-label="Clear search" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(""); document.getElementById(id)?.focus(); }}
                    className="grid h-8 w-8 flex-none cursor-pointer place-items-center rounded-full border-0 bg-[var(--sunken)] text-[var(--mute)] transition hover:text-[var(--ink)]">
                    <IX />
                </button>
            )}
            {!value && !hero && (
                <kbd aria-hidden="true" className="mr-1 hidden rounded-md border border-[var(--line2)] bg-[var(--sunken)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--faint)] lg:inline">/</kbd>
            )}
            {hero && (
                <button type="submit" aria-label="Find jobs" className={`${btn} ${btnBrand} !min-h-[46px] !rounded-xl max-sm:!w-[46px] max-sm:!px-0`}>
                    <span className="max-sm:hidden">Find jobs</span>
                    <span className="sm:hidden"><ISearch size={18} /></span>
                    <span className="max-sm:hidden"><IArrow /></span>
                </button>
            )}

            {showList && (
                <ul id={listId} role="listbox"
                    className="fi absolute inset-x-0 top-full z-50 m-0 mt-2 max-h-[min(60dvh,360px)] list-none overflow-y-auto overscroll-contain rounded-2xl border border-[var(--line2)] bg-[var(--surface)] p-1.5 shadow-[var(--sh2)]">
                    {items.map((it, n) => {
                        const head = it.kind !== lastKind;
                        lastKind = it.kind;
                        return (
                            <li key={`${it.kind}-${it.label}`} role="presentation">
                                {head && (
                                    <div className="flex items-center justify-between px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[.1em] text-[var(--faint)]">
                                        <span>{value.trim() ? "Suggestions" : it.kind === "Recent" ? "Recent searches" : "Popular"}</span>
                                        {!value.trim() && it.kind === "Recent" && (
                                            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClearRecent}
                                                className="cursor-pointer border-0 bg-transparent p-0 text-[11px] font-bold normal-case tracking-normal text-[var(--brand)] hover:underline">Clear</button>
                                        )}
                                    </div>
                                )}
                                <div id={`${id}-opt-${n}`} role="option" aria-selected={hi === n}
                                    onMouseDown={(e) => { e.preventDefault(); choose(it); }}
                                    onMouseEnter={() => setHi(n)}
                                    className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl px-3 text-[14px] ${hi === n ? "bg-[var(--sunken)]" : ""}`}>
                                    <span className="text-[var(--faint)]">{it.kind === "Recent" ? <IHistory /> : <ISearch size={14} />}</span>
                                    <span className="min-w-0 flex-1 truncate font-semibold">{it.label}</span>
                                    {it.kind !== "Recent" && <span className="flex-none text-xs text-[var(--faint)]">{it.kind}</span>}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </form>
    );
}

function SectorTabs({ value, onChange, counts }) {
    const items = [["all", "All jobs"], ["govt", "Government"], ["private", "Private"]];
    return (
        <div role="tablist" aria-label="Job sector"
            className="flex w-full gap-1 rounded-xl border border-[var(--line)] bg-[var(--sunken)] p-1 sm:inline-flex sm:w-auto">
            {items.map(([v, l]) => {
                const on = value === v;
                return (
                    <button key={v} type="button" role="tab" aria-selected={on} onClick={() => onChange(v)}
                        className={`flex min-h-[42px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-0 px-2 text-[13px] font-bold transition duration-200 sm:flex-none sm:gap-2 sm:px-5 sm:text-[13.5px] ${on ? "bg-[var(--surface)] text-[var(--brand)] shadow-[var(--sh1)]" : "bg-transparent text-[var(--mute)] hover:text-[var(--ink)]"}`}>
                        {l}
                        <span className={`rounded-full px-2 py-px text-xs tabular-nums ${on ? "bg-[var(--soft)]" : "bg-[var(--line)]"}`}>{counts[v]}</span>
                    </button>
                );
            })}
        </div>
    );
}

/** Smooth height animation without measuring anything (grid rows 0fr -> 1fr). */
const Collapse = ({ open, children }) => (
    <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden" aria-hidden={!open} {...(open ? {} : { inert: "" })}>{children}</div>
    </div>
);

function FilterGroup({ title, value, options, onChange, narrow, open, onToggle }) {
    const LIMIT = 5;
    const [all, setAll] = useState(false);
    const sel = options.find((o) => o[0] === value);
    // first few options always visible (plus the selected one); the rest slide open on request
    const rest = options.slice(LIMIT);
    const pinned = rest.find((o) => o === sel);
    const head = pinned ? [...options.slice(0, LIMIT), pinned] : options.slice(0, LIMIT);
    const extra = rest.filter((o) => o !== pinned);
    const summary = value !== "all" && sel ? sel[1] : "";

    const Opt = (o) => {
        const [v, l, c] = o;
        const on = value === v;
        const none = c === 0 && !on;
        return narrow ? (
            <button key={v} type="button" role="radio" aria-checked={on} disabled={none} onClick={() => onChange(v)}
                className={`min-h-[40px] cursor-pointer rounded-full border px-3.5 text-[13px] font-semibold transition duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${on ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]" : "border-[var(--line2)] bg-[var(--surface)] text-[var(--ink)]"}`}>
                {l} {c !== undefined && <span className="opacity-60">{c}</span>}
            </button>
        ) : (
            <button key={v} type="button" role="radio" aria-checked={on} disabled={none} onClick={() => onChange(v)}
                className={`group flex min-h-[40px] cursor-pointer items-center gap-3 rounded-lg border-0 px-3 text-left text-[13.5px] transition duration-200 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 ${on ? "bg-[var(--soft)] font-semibold text-[var(--brand)]" : "bg-transparent font-medium text-[var(--ink)] hover:bg-[var(--sunken)]"}`}>
                <span aria-hidden="true" className={`grid h-[18px] w-[18px] flex-none place-items-center rounded-full border-2 transition-colors duration-200 ${on ? "border-[var(--brand)] bg-[var(--brand)]" : "border-[var(--line2)] group-hover:border-[var(--faint)]"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full bg-[var(--bi)] transition-transform duration-200 ${on ? "scale-100" : "scale-0"}`} />
                </span>
                <span className="min-w-0 flex-1 truncate">{l}</span>
                {c !== undefined && <span className={`rounded-full px-1.5 text-xs tabular-nums transition-colors ${on ? "bg-[var(--surface)] text-[var(--brand)]" : "text-[var(--faint)]"}`}>{c}</span>}
            </button>
        );
    };

    const body = (
        <div role="radiogroup" aria-label={title} className={narrow ? "flex flex-wrap gap-2 pb-3 pt-1" : "grid gap-0.5"}>
            {head.map(Opt)}
            {extra.length > 0 && (
                <div className={narrow ? "contents" : "block"}>
                    {narrow ? (all && extra.map(Opt)) : (
                        <Collapse open={all}><div className="grid gap-0.5">{extra.map(Opt)}</div></Collapse>
                    )}
                </div>
            )}
            {extra.length > 0 && (
                <button type="button" onClick={() => setAll((x) => !x)} aria-expanded={all}
                    className={`inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent text-[13px] font-semibold text-[var(--brand)] hover:underline ${narrow ? "min-h-[40px] px-2" : "min-h-[38px] px-3"}`}>
                    <span aria-hidden="true" className={`inline-block transition-transform duration-300 ${all ? "rotate-180" : ""}`}>▾</span>
                    {all ? "Show less" : `Show all ${options.length}`}
                </button>
            )}
        </div>
    );

    return (
        <fieldset className="m-0 min-w-0 border-0 p-0">
            {narrow ? (
                <>
                    <button type="button" onClick={onToggle} aria-expanded={open}
                        className="flex min-h-[52px] w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent p-0 text-left">
                        <span className="text-[14px] font-bold">{title}</span>
                        <span className="flex min-w-0 items-center gap-2">
                            {summary && <span className="chipin max-w-[16ch] truncate rounded-full bg-[var(--soft)] px-2.5 py-0.5 text-[12.5px] font-semibold text-[var(--brand)]">{summary}</span>}
                            <span aria-hidden="true" className={`text-[var(--faint)] transition-transform duration-300 ${open ? "rotate-180" : ""}`}>▾</span>
                        </span>
                    </button>
                    <Collapse open={open}>{body}</Collapse>
                </>
            ) : (
                <>
                    <legend className="mb-2 flex w-full items-center justify-between p-0 text-[11px] font-bold uppercase tracking-[.1em] text-[var(--faint)]">
                        {title}
                        {summary && <span className="chipin max-w-[14ch] truncate rounded-full bg-[var(--soft)] px-2 py-0.5 text-[11px] normal-case tracking-normal text-[var(--brand)]">{summary}</span>}
                    </legend>
                    {body}
                </>
            )}
        </fieldset>
    );
}

/** One labelled fact on a job card: small label above, value below. */
function Fact({ icon, label, children }) {
    return (
        <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-lg bg-[var(--sunken)] text-[var(--mute)] transition-colors duration-200 group-hover:bg-[var(--soft)] group-hover:text-[var(--brand)]">{icon}</span>
            <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-[.06em] text-[var(--faint)]">{label}</dt>
                <dd className="m-0 break-words text-[13.5px] font-semibold leading-snug text-[var(--ink)]">{children}</dd>
            </div>
        </div>
    );
}

function JobRow({ j, i, tk, saved, onSave }) {
    const navigate = useNavigate();
    const closed = isExpired(j);
    const left = closing(j);
    const fourth = j.salary
        ? [<IWallet key="f" />, isGovt(j) ? "Pay scale" : "Salary", j.salary]
        : j.vacancies
            ? [<IUsers key="f" />, "Vacancies", vacLabel(j.vacancies)]
            : [<ITag key="f" />, "Category", <Hl key="c" text={j.cat} tk={tk} />];

    return (
        <article
            onClick={() => navigate(jobUrl(j))}
            style={{ "--d": `${Math.min(i, 8) * 0.04}s` }}
            className={`rise group relative cursor-pointer overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh1)] transition duration-300 hover:border-[var(--line2)] hover:shadow-[var(--sh2)] lg:hover:-translate-y-0.5 ${closed ? "opacity-70" : ""}`}
        >
            {/* thin colour edge tells government and private apart at a glance */}
            <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${closed ? "bg-[var(--line2)]" : isGovt(j) ? "bg-[var(--brand)]" : "bg-[var(--faint)] opacity-50"}`} />

            <button type="button" aria-pressed={saved} aria-label={saved ? `Remove ${j.role} from saved jobs` : `Save ${j.role}`}
                onClick={(e) => { e.stopPropagation(); onSave(slug(j)); }}
                className={`absolute right-2 top-2 z-[1] grid h-11 w-11 cursor-pointer place-items-center rounded-full border-0 bg-transparent transition duration-200 hover:bg-[var(--sunken)] sm:right-3 sm:top-3 ${saved ? "text-[var(--brand)]" : "text-[var(--faint)] hover:text-[var(--ink)]"}`}>
                <span key={String(saved)} className={saved ? "pop inline-flex" : "inline-flex"}><IBookmark on={saved} /></span>
            </button>

            {/* 1. who and what */}
            <div className="p-4 pb-4 sm:p-5 sm:pb-5 sm:pl-6">
                <div className="flex min-w-0 items-start gap-3.5">
                    <Mono company={j.company} className="h-11 w-11 text-sm sm:h-12 sm:w-12 sm:text-[15px]" />
                    <div className="min-w-0 flex-1 pr-9">
                        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                            <Tag tone={isGovt(j) ? "gov" : "pvt"}>{isGovt(j) ? "Government" : "Private"}</Tag>
                            {isNew(j) && <Tag>New</Tag>}
                            {j.exp === "fresher" && <Tag tone="pvt">Freshers</Tag>}
                        </div>
                        <h3 className="m-0 text-[1.05rem] font-semibold leading-snug tracking-[-.01em] sm:text-[1.1rem]">
                            <Link to={jobUrl(j)} onClick={(e) => e.stopPropagation()} className="text-inherit no-underline group-hover:text-[var(--brand)]"><Hl text={j.role} tk={tk} /></Link>
                        </h3>
                        <p className="mb-0 mt-0.5 text-sm font-medium text-[var(--mute)]"><Hl text={j.company} tk={tk} /></p>
                    </div>
                </div>

                {/* 2. the facts people compare */}
                <dl className="m-0 mt-4 grid grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-4">
                    <Fact icon={<IPin />} label="Location"><Hl text={j.location} tk={tk} /></Fact>
                    <Fact icon={<ICap />} label="Experience">{expText(j)}</Fact>
                    <Fact icon={<IBag />} label="Job type">{j.type}</Fact>
                    <Fact icon={fourth[0]} label={fourth[1]}>{fourth[2]}</Fact>
                </dl>
            </div>

            {/* 3. timing and actions */}
            <div className="flex flex-col gap-3 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--sunken)_55%,transparent)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:pl-6">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                    <span className="text-[var(--faint)]">{ago(j.posted)}</span>
                    {j.deadline && (closed
                        ? <Tag tone="bad">Closed on {fmtDate(j.deadline)}</Tag>
                        : <Tag tone={left?.late ? "warn" : "ok"}><IClock /> {left ? `${left.t} · ` : ""}{fmtDate(j.deadline)}</Tag>)}
                </div>
                {closed ? (
                    <Link to={jobUrl(j)} onClick={(e) => e.stopPropagation()} className={btn}>View details</Link>
                ) : (
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                        <Link to={jobUrl(j)} onClick={(e) => e.stopPropagation()} className={btn}>Details</Link>
                        <a href={j.link} target="_blank" rel="noopener noreferrer"
                            onClick={(e) => { e.stopPropagation(); trackClick(j); }}
                            className={`${btn} ${btnBrand}`}>
                            Apply <IArrow />
                        </a>
                    </div>
                )}
            </div>
        </article>
    );
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */
function Footer({ onHome }) {
    const year = new Date().getFullYear();
    const linkItem =
        "group inline-flex min-h-[36px] items-center gap-2 text-sm font-semibold text-[var(--mute)] no-underline transition-colors duration-200 hover:text-[var(--brand)]";
    const social =
        "group inline-flex h-11 items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 text-sm font-bold text-[var(--ink)] no-underline transition duration-300 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--brand)_50%,var(--line))] hover:shadow-[var(--sh2)] active:scale-[.97]";
    const arrow = <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>;

    return (
        <footer className="relative overflow-hidden bg-[var(--surface)]">
            {/* gradient hairline on top */}
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px]" style={gradBg} />
            {/* soft colour wash */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0"
                style={{
                    backgroundImage:
                        "radial-gradient(50% 80% at 0% 0%,color-mix(in srgb,var(--brand) 10%,transparent),transparent 70%),radial-gradient(45% 70% at 100% 100%,color-mix(in srgb,var(--brand2) 9%,transparent),transparent 70%)",
                }} />

            <div className={`${wrap} relative pb-8 pt-10 sm:pt-14`}>
                <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1.2fr] md:gap-12">
                    {/* Brand */}
                    <div>
                        <Link to="/" onClick={onHome} aria-label={`${SITE_NAME} home`} className="group inline-block no-underline">
                            <Logo size={44} text="text-[20px]" />
                        </Link>
                        <p className="mb-0 mt-4 max-w-[38ch] text-sm leading-relaxed text-[var(--mute)]">
                            Fresh government and private job openings, with dates, eligibility and official links in one place.
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2.5">
                            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={social}>
                                <span className="text-[#e1306c] transition-transform duration-300 group-hover:scale-110"><IInsta /></span>
                                @{INSTAGRAM_HANDLE}
                            </a>
                            {WHATSAPP_URL && (
                                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={social}>
                                    <span className="text-[#25D366] transition-transform duration-300 group-hover:scale-110"><IWhatsApp size={18} /></span>
                                    WhatsApp
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Quick links */}
                    <nav aria-label="Footer">
                        <h2 className="m-0 mb-3 text-[11px] font-extrabold uppercase tracking-[.14em] text-[var(--brand)]">Explore</h2>
                        <ul className="m-0 grid list-none gap-0.5 p-0">
                            <li><Link to="/" onClick={onHome} className={linkItem}>{arrow} Home</Link></li>
                            <li><a href="#jobs" className={linkItem}>{arrow} All job openings</a></li>
                            <li><a href="#how" className={linkItem}>{arrow} How it works</a></li>
                            <li><a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={linkItem}>{arrow} Follow on Instagram</a></li>
                            {WHATSAPP_URL && (
                                <li><a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={linkItem}>{arrow} Join WhatsApp alerts</a></li>
                            )}
                        </ul>
                    </nav>

                    {/* Trust note */}
                    <div className="self-start rounded-2xl border border-[color-mix(in_srgb,var(--brand)_22%,var(--line))] bg-[var(--soft)] p-4 sm:p-5">
                        <div className="flex items-center gap-2.5 text-[var(--ink)]">
                            <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[var(--surface)] text-[var(--brand)] shadow-[var(--sh1)]"><IShield size={18} /></span>
                            <b className="text-[.95rem]">Apply safely</b>
                        </div>
                        <p className="mb-0 mt-3 text-[13px] leading-relaxed text-[var(--mute)]">
                            Always apply through the official link and never pay money to get a job. Real employers do not charge for hiring.
                        </p>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="mt-10 flex flex-col gap-3 border-t border-[var(--line)] pt-6 text-[12.5px] leading-relaxed text-[var(--mute)] sm:flex-row sm:items-center sm:justify-between sm:text-[13px]">
                    <span className="font-semibold text-[var(--ink)]">© {year} {SITE_NAME}. All rights reserved.</span>
                    <span className="max-w-[62ch] sm:text-right">
                        {SITE_NAME} is an independent job-information site and is not affiliated with any employer. Please verify all details in the official notification.
                    </span>
                </div>
            </div>
        </footer>
    );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function LandingPage() {
    const [params, setParams] = useSearchParams();
    const [jobs, setJobs] = useState(null);
    const [f, setF] = useState(() => fromParams(params));
    const [sort, setSort] = useState("auto");
    const [dark, setDark] = useState(false);
    const [panel, setPanel] = useState(false);
    const [ph, setPh] = useState("Search company, role or city");
    const [focused, setFocused] = useState(false);
    const [visible, setVisible] = useState(PAGE);
    const [savedIds, setSavedIds] = useState(() => readList("js-saved"));
    const [recent, setRecent] = useState(() => readList("js-recent"));
    const [showTop, setShowTop] = useState(false);
    const [narrow, setNarrow] = useState(false);
    const [grp, setGrp] = useState(null);

    // page title (so it resets to the site name after visiting a job page)
    useEffect(() => {
        document.title = `${SITE_NAME} – Government and private job openings`;
    }, []);

    // theme
    useEffect(() => {
        try {
            const t = localStorage.getItem("js-theme");
            if (t) setDark(t === "dark");
        } catch { }
    }, []);
    useEffect(() => {
        document.documentElement.dataset.theme = dark ? "dark" : "light";
        try { localStorage.setItem("js-theme", dark ? "dark" : "light"); } catch { }
    }, [dark]);

    // data (locations are tidied so "karnataka" and "Karnataka" merge)
    useEffect(() => {
        fetch("/jobs.json?v=" + Date.now(), { cache: "no-store" })
            .then((r) => { if (!r.ok) throw 0; return r.json(); })
            .then((d) => setJobs(cleanJobs(Array.isArray(d) ? d : FALLBACK)))
            .catch(() => setJobs(cleanJobs(FALLBACK)));
    }, []);

    // keep the URL in step with the filters (replace, so Back never gets filled with filter steps)
    const fKey = toParams(f).toString();
    useEffect(() => {
        if (fKey !== params.toString()) setParams(toParams(f), { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fKey]);

    // show 10 at a time, start again whenever the search or filters change
    useEffect(() => { setVisible(PAGE); }, [fKey, sort]);

    // back-to-top button + "/" focuses search
    useEffect(() => {
        const onScroll = () => setShowTop(window.scrollY > 900);
        const onKey = (e) => {
            if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
            const t = e.target;
            if (t instanceof HTMLElement && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
            e.preventDefault();
            const hero = document.getElementById("hero-search");
            const r = hero?.getBoundingClientRect();
            (r && r.bottom > 80 && r.top < window.innerHeight ? hero : document.getElementById("board-search"))?.focus();
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("keydown", onKey);
        return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("keydown", onKey); };
    }, []);

    // phones and tablets get the compact accordion filters
    useEffect(() => {
        const mq = window.matchMedia("(max-width:1023px)");
        const on = () => setNarrow(mq.matches);
        on();
        mq.addEventListener("change", on);
        return () => mq.removeEventListener("change", on);
    }, []);

    // filter sheet (phones): lock page scroll, close on Escape
    useEffect(() => {
        if (!panel) return;
        const onKey = (e) => e.key === "Escape" && setPanel(false);
        window.addEventListener("keydown", onKey);
        const narrow = window.matchMedia("(max-width:1023px)").matches;
        const prev = document.body.style.overflow;
        if (narrow) document.body.style.overflow = "hidden";
        return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
    }, [panel]);

    /* ---------- derived data ---------- */
    const list = jobs || [];
    const tk = useMemo(() => tokensOf(f.q), [f.q]);
    const savedSet = useMemo(() => new Set(savedIds), [savedIds]);
    // closed jobs stay hidden unless asked for (or you are looking at your saved list)
    const base = useMemo(() => (f.closed || f.saved ? list : list.filter((j) => !isExpired(j))), [list, f.closed, f.saved]);
    const scoped = useMemo(() => (f.sector === "all" ? base : base.filter((j) => sectorOf(j) === f.sector)), [base, f.sector]);

    const cats = useMemo(() => [...new Set(scoped.map((j) => j.cat).filter(Boolean))].sort(), [scoped]);
    const types = useMemo(() => [...new Set(scoped.map((j) => j.type).filter(Boolean))].sort(), [scoped]);
    const locs = useMemo(() => [...new Set(scoped.map((j) => j.location).filter(Boolean))].sort(), [scoped]);

    // counts that respect every OTHER active filter, so a number never promises jobs that are not there
    const facet = (key, test) => base.filter((j) => passes(j, f, tk, key, savedSet) && test(j)).length;
    const fc = (key, v) => facet(key, (j) => v === "all" || j[key === "loc" ? "location" : key] === v);
    const sectorCounts = {
        all: facet("sector", () => true),
        govt: facet("sector", (j) => isGovt(j)),
        private: facet("sector", (j) => !isGovt(j)),
    };

    const open = useMemo(() => list.filter((j) => !isExpired(j)), [list]);
    const latest = useMemo(() => [...open].sort((a, b) => daysAgo(a.posted) - daysAgo(b.posted)).slice(0, 3), [open]);
    const topLocs = useMemo(() => {
        const c = {};
        open.forEach((j) => { c[j.location] = (c[j.location] || 0) + 1; });
        return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([l]) => l);
    }, [open]);

    // suggestion list: every role, company, city and category once
    const searchIndex = useMemo(() => {
        const seen = new Set();
        const out = [];
        const add = (label, kind) => {
            if (!label) return;
            const k = `${kind}|${String(label).toLowerCase()}`;
            if (seen.has(k)) return;
            seen.add(k);
            out.push({ label: String(label), kind });
        };
        open.forEach((j) => { add(j.role, "Role"); add(j.company, "Company"); add(j.location, "City"); add(j.cat, "Category"); });
        return out;
    }, [open]);
    const popular = useMemo(() => {
        const top = (get, kind, n) => {
            const c = {};
            open.forEach((j) => { const v = get(j); if (v) c[v] = (c[v] || 0) + 1; });
            return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n).map(([label]) => ({ label, kind }));
        };
        return [...top((j) => j.cat, "Category", 3), ...top((j) => j.location, "City", 2)];
    }, [open]);

    const rows = useMemo(() => {
        const eff = sort === "auto" ? (tk.length ? "rel" : "new") : sort;
        const dl = (j) => { const d = toLocalDate(j.deadline); return d ? d.getTime() : Infinity; };
        return base
            .filter((j) => passes(j, f, tk, "", savedSet))
            .sort((a, b) => {
                const e = Number(isExpired(a)) - Number(isExpired(b));
                if (e) return e;
                if (eff === "rel") { const r = relevance(b, tk) - relevance(a, tk); if (r) return r; }
                if (eff === "close") { const c = dl(a) - dl(b); if (c) return c; }
                if (eff === "vac") { const v = vacNum(b) - vacNum(a); if (v) return v; }
                return daysAgo(a.posted) - daysAgo(b.posted);
            });
    }, [base, f, tk, savedSet, sort]);

    // for the empty state: how many jobs match the words alone
    const looseCount = useMemo(() => open.filter((j) => tk.every((t) => j._h.includes(t))).length, [open, tk]);

    const activeCount = FILTER_KEYS.filter((k) => f[k] !== DEFAULTS[k]).length;
    const dirty = activeCount > 0 || f.q.trim() !== "" || f.saved || f.sector !== "all";
    const savedCount = list.filter((j) => savedSet.has(slug(j))).length;

    const chips = [];
    if (f.q.trim()) chips.push(["q", `“${f.q.trim()}”`]);
    if (f.cat !== "all") chips.push(["cat", f.cat]);
    if (f.exp !== "all") chips.push(["exp", f.exp === "fresher" ? "Freshers" : "Experienced"]);
    if (f.type !== "all") chips.push(["type", f.type]);
    if (f.loc !== "all") chips.push(["loc", f.loc]);
    if (f.posted !== "all") chips.push(["posted", `Last ${f.posted} days`]);
    if (f.closed) chips.push(["closed", "Including closed"]);

    // rotating placeholder in the hero search
    useEffect(() => {
        const w = [...new Set(open.flatMap((j) => [j.role, j.location, j.company]))].slice(0, 8);
        if (w.length < 2) return;
        let i = 0;
        const id = setInterval(() => {
            if (f.q || focused) return;
            i = (i + 1) % w.length;
            setPh(`Search “${w[i]}”`);
        }, 2600);
        return () => clearInterval(id);
    }, [open, f.q, focused]);

    /* ---------- actions ---------- */
    const setKey = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
    const setSector = (v) => setF((s) => ({ ...s, sector: v, cat: "all", type: "all", loc: "all" }));
    const resetAll = () => setF(DEFAULTS);
    const goJobs = () => document.getElementById("jobs")?.scrollIntoView({ behavior: "smooth" });
    const quick = (k, v) => {
        setF((s) => ({ ...s, [k]: s[k] === v ? "all" : v }));
        goJobs();
    };
    const commitSearch = (v) => {
        const t = String(v ?? f.q).trim();
        if (t.length >= 2) {
            setRecent((r) => {
                const n = [t, ...r.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 5);
                writeList("js-recent", n);
                return n;
            });
        }
        goJobs();
    };
    const clearRecent = () => { setRecent([]); writeList("js-recent", []); };
    const toggleSave = useCallback((id) => {
        setSavedIds((s) => {
            const n = s.includes(id) ? s.filter((x) => x !== id) : [id, ...s];
            writeList("js-saved", n);
            return n;
        });
    }, []);
    const chip = (on) =>
        `min-h-[36px] shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition duration-200 ${on ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]" : "border-[var(--line2)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--ink)]"}`;

    const sortOptions = [
        ...(tk.length ? [["auto", "Best match"]] : []),
        ["new", "Newest first"],
        ["close", "Closing soon"],
        ["vac", "Most vacancies"],
    ];
    const sortValue = sort === "auto" && !tk.length ? "new" : sort;

    const shown = rows.slice(0, visible);
    const remaining = rows.length - shown.length;

    const filters = (
        <div className="grid gap-4 max-lg:gap-0 max-lg:divide-y max-lg:divide-[var(--line)]">
            <FilterGroup key={`Category-${narrow}`} narrow={narrow} open={!narrow || grp === "Category"} onToggle={() => setGrp((g) => (g === "Category" ? null : "Category"))} title="Category" value={f.cat} onChange={setKey("cat")}
                options={[["all", "All categories", fc("cat", "all")], ...cats.map((c) => [c, c, fc("cat", c)])]} />
            <FilterGroup key={`Experience-${narrow}`} narrow={narrow} open={!narrow || grp === "Experience"} onToggle={() => setGrp((g) => (g === "Experience" ? null : "Experience"))} title="Experience" value={f.exp} onChange={setKey("exp")}
                options={[["all", "Any experience", fc("exp", "all")], ["fresher", "Freshers", fc("exp", "fresher")], ["exp", "Experienced", fc("exp", "exp")]]} />
            <FilterGroup key={`Job type-${narrow}`} narrow={narrow} open={!narrow || grp === "Job type"} onToggle={() => setGrp((g) => (g === "Job type" ? null : "Job type"))} title="Job type" value={f.type} onChange={setKey("type")}
                options={[["all", "All types", fc("type", "all")], ...types.map((t) => [t, t, fc("type", t)])]} />
            <FilterGroup key={`Location-${narrow}`} narrow={narrow} open={!narrow || grp === "Location"} onToggle={() => setGrp((g) => (g === "Location" ? null : "Location"))} title="Location" value={f.loc} onChange={setKey("loc")}
                options={[["all", "All locations", fc("loc", "all")], ...locs.map((t) => [t, t, fc("loc", t)])]} />
            <FilterGroup key={`Posted-${narrow}`} narrow={narrow} open={!narrow || grp === "Posted"} onToggle={() => setGrp((g) => (g === "Posted" ? null : "Posted"))} title="Posted" value={f.posted} onChange={setKey("posted")}
                options={POSTED.map(([v, l]) => [v, l, v === "all" ? facet("posted", () => true) : facet("posted", (j) => daysAgo(j.posted) <= Number(v))])} />
            <button type="button" role="switch" aria-checked={f.closed} onClick={() => setKey("closed")(!f.closed)}
                className="flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-3 rounded-lg border-0 bg-transparent px-3 text-left text-[13.5px] font-medium text-[var(--ink)] transition hover:bg-[var(--sunken)]">
                <span>Include closed jobs</span>
                <span aria-hidden="true" className={`relative h-6 w-10 flex-none rounded-full transition-colors duration-200 ${f.closed ? "bg-[var(--brand)]" : "bg-[var(--line2)]"}`}>
                    <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${f.closed ? "translate-x-4" : ""}`} />
                </span>
            </button>
        </div>
    );

    return (
        <div className="min-h-[100dvh] bg-[var(--bg)] pb-[env(safe-area-inset-bottom,0px)] text-base leading-relaxed text-[var(--ink)]">
            <style>{CSS}</style>

            {/* ============================ NAV ============================ */}
            <nav aria-label="Main" className="glass sticky top-0 z-40 border-b border-[var(--line)] pt-[env(safe-area-inset-top,0px)]">
                <div className={`${wrap} flex h-16 items-center justify-between gap-2 sm:gap-3`}>
                    <Link to="/" onClick={resetAll} aria-label={`${SITE_NAME} home`} className="group min-w-0 no-underline">
                        <Logo />
                    </Link>
                    <ul className="m-0 flex list-none items-center gap-1 p-0">
                        {[["#jobs", "All jobs"], ["#how", "How it works"]].map(([h, l]) => (
                            <li key={h} className="max-md:hidden">
                                <a href={h} className="inline-block rounded-lg px-3.5 py-2 text-sm font-medium text-[var(--mute)] no-underline transition hover:bg-[var(--sunken)] hover:text-[var(--ink)]">{l}</a>
                            </li>
                        ))}
                        <li><NotifyButton className={`${btn} !min-h-[40px] !px-3`} /></li>
                        <li>
                            <button type="button" onClick={() => setDark((d) => !d)} aria-label="Switch light or dark mode" className={`${btn} !min-h-[40px] !px-3`}>
                                <span aria-hidden="true">{dark ? "☀️" : "🌙"}</span>
                                <span className="max-sm:hidden">{dark ? "Light" : "Dark"}</span>
                            </button>
                        </li>
                        <li className="ml-1 max-md:hidden">
                            <a className={`${btn} ${btnBrand} !min-h-[40px]`} href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                                Follow on Instagram
                            </a>
                        </li>
                    </ul>
                </div>
            </nav>

            <main>
                {/* ============================ HERO ============================ */}
                {/* z-[35] keeps the suggestion list above the sticky bar below */}
                <header className="relative z-[35] border-b border-[var(--line)]">
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                        <div className="grain absolute inset-0" />
                        <div className="blob absolute -right-20 -top-[120px] hidden h-[440px] w-[440px] rounded-full opacity-[.2] sm:block"
                            style={{ backgroundImage: "radial-gradient(circle,var(--brand) 0%,transparent 68%)" }} />
                        <div className="blob absolute -bottom-[140px] -left-[60px] hidden h-[340px] w-[340px] rounded-full opacity-[.16] lg:block"
                            style={{ backgroundImage: "radial-gradient(circle,var(--brand2) 0%,transparent 68%)", animationDelay: "-6s" }} />
                    </div>
                    <div className={`${wrap} relative grid items-center gap-10 py-10 sm:py-16 lg:grid-cols-[1.25fr_.75fr] lg:gap-12 lg:py-20`}>
                        <div className="min-w-0">
                            <span className="rise mb-5 inline-flex max-w-full items-center gap-2.5 rounded-full border border-[var(--line2)] bg-[var(--surface)] py-1.5 pl-3 pr-3.5 text-[12.5px] font-semibold text-[var(--mute)] sm:mb-6">
                                <span className="live h-2 w-2 flex-none rounded-full bg-green-500" />
                                <span className="truncate">
                                    {latest[0] ? `Latest opening: ${ago(latest[0].posted).replace("Posted ", "")}` : "Verified openings, updated daily"}
                                </span>
                            </span>
                            <h1 className="serif rise mb-4 mt-0 text-balance text-[clamp(2.1rem,6.4vw,4.4rem)] font-extrabold leading-[1.08] tracking-[-.03em] sm:mb-5" style={{ "--d": ".06s" }}>
                                Find your next role,<br />
                                <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg,var(--brand),var(--brand2))" }}>without the noise.</span>
                            </h1>
                            <p className="rise mb-7 mt-0 max-w-[52ch] text-[.97rem] text-[var(--mute)] sm:mb-8 sm:text-[1.075rem]" style={{ "--d": ".14s" }}>
                                Government and private openings for freshers and experienced candidates, all in one place. Read the details, then apply through the official link.
                            </p>

                            <div className="rise" style={{ "--d": ".22s" }}>
                                <SearchBox id="hero-search" variant="hero" value={f.q} onChange={setKey("q")} onSubmit={commitSearch}
                                    index={searchIndex} recent={recent} popular={popular} onClearRecent={clearRecent}
                                    placeholder={ph} onFocusChange={setFocused} />
                            </div>

                            <div className="rise noscroll -mx-4 mt-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" style={{ "--d": ".3s" }}>
                                <span className="mr-1 flex-none text-[13px] font-medium text-[var(--faint)]">Popular</span>
                                <button type="button" aria-pressed={f.exp === "fresher"} onClick={() => quick("exp", "fresher")} className={chip(f.exp === "fresher")}>Freshers</button>
                                <button type="button" aria-pressed={f.sector === "govt"} onClick={() => { setSector(f.sector === "govt" ? "all" : "govt"); goJobs(); }} className={chip(f.sector === "govt")}>Government</button>
                                <button type="button" aria-pressed={f.sector === "private"} onClick={() => { setSector(f.sector === "private" ? "all" : "private"); goJobs(); }} className={chip(f.sector === "private")}>Private</button>
                                {topLocs.map((l) => (
                                    <button key={l} type="button" aria-pressed={f.loc === l} onClick={() => quick("loc", l)} className={chip(f.loc === l)}>{l}</button>
                                ))}
                            </div>

                            <ul className="rise m-0 mt-5 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-[13px] font-medium text-[var(--mute)]" style={{ "--d": ".38s" }}>
                                {["Free to use", "Official apply links", "No signup needed"].map((t) => (
                                    <li key={t} className="inline-flex items-center gap-1.5"><span className="text-[var(--ok)]"><ICheck /></span>{t}</li>
                                ))}
                            </ul>
                        </div>

                        <aside className="rise min-w-0" style={{ "--d": ".3s" }} aria-label="Overview">
                            <dl className="m-0 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] shadow-[var(--sh1)]">
                                {[
                                    ["Open jobs", open.length],
                                    ["Government", open.filter(isGovt).length],
                                    ["Private", open.filter((j) => !isGovt(j)).length],
                                    ["New this week", list.filter(isNew).length],
                                ].map(([l, n]) => (
                                    <div key={l} className="bg-[var(--surface)] px-4 py-3.5 sm:px-5 sm:py-4">
                                        <dd className="serif m-0 text-[1.7rem] font-semibold leading-none tracking-[-.02em] sm:text-[2rem]"><CountUp to={n} /></dd>
                                        <dt className="mt-2 text-xs font-medium text-[var(--mute)]">{l}</dt>
                                    </div>
                                ))}
                            </dl>

                            {latest.length > 0 && (
                                <div className="mt-4 hidden overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh1)] lg:block">
                                    <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
                                        <b className="text-sm">Just added</b>
                                        <span className="text-xs font-semibold text-[var(--brand)]">Latest 3</span>
                                    </div>
                                    {latest.map((j) => (
                                        <Link key={slug(j)} to={jobUrl(j)} className="group flex items-center gap-3 border-b border-[var(--line)] px-5 py-3.5 text-[var(--ink)] no-underline transition last:border-b-0 hover:bg-[var(--sunken)]">
                                            <Mono company={j.company} className="h-10 w-10 text-sm" />
                                            <span className="min-w-0 flex-1">
                                                <b className="block truncate text-sm leading-tight">{j.role}</b>
                                                <small className="block truncate text-[13px] text-[var(--mute)]">{j.company} · {j.location}</small>
                                            </span>
                                            {isGovt(j) && <Tag tone="gov">Govt</Tag>}
                                            <span className="text-[var(--faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--brand)]"><IArrow /></span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </aside>
                    </div>
                </header>

                {/* ============================ BOARD ============================ */}
                <section id="jobs" className="scroll-mt-16 pb-14 sm:pb-20" aria-labelledby="jobs-title">
                    <div className={`${wrap} pb-5 pt-10 sm:pt-14`}>
                        <p className="m-0 mb-1.5 text-[11px] font-bold uppercase tracking-[.12em] text-[var(--gold)]">Job board</p>
                        <h2 id="jobs-title" className="serif m-0 text-[clamp(1.6rem,3.6vw,2.4rem)] font-semibold tracking-[-.02em]">Latest openings</h2>
                        <p className="mb-0 mt-2 max-w-[56ch] text-[.95rem] text-[var(--mute)]">Search by role, company or city. Open a job to read the full details before you apply.</p>
                    </div>

                    {/* sticky bar: search is always one tap away while you scroll the list */}
                    <div className="glass sticky top-[calc(4rem+env(safe-area-inset-top,0px))] z-30 border-y border-[var(--line)] py-2.5">
                        <div className={`${wrap} flex items-center gap-2`}>
                            <SearchBox id="board-search" variant="bar" value={f.q} onChange={setKey("q")} onSubmit={commitSearch}
                                index={searchIndex} recent={recent} popular={popular} onClearRecent={clearRecent}
                                placeholder="Search role, company or city" />
                            <button type="button" aria-pressed={f.saved} onClick={() => setKey("saved")(!f.saved)}
                                aria-label={`Saved jobs (${savedCount})`}
                                className={`${btn} relative !min-h-[44px] !px-3 ${f.saved ? "!border-[var(--brand)] !text-[var(--brand)]" : ""}`}>
                                <IBookmark on={f.saved} size={17} />
                                <span className="max-sm:hidden">Saved</span>
                                {savedCount > 0 && <span className="rounded-full bg-[var(--soft)] px-1.5 text-xs tabular-nums text-[var(--brand)]">{savedCount}</span>}
                            </button>
                            <button type="button" onClick={() => setPanel(true)} aria-haspopup="dialog" aria-expanded={panel}
                                className={`${btn} !min-h-[44px] !px-3 lg:hidden`}>
                                <IFilter /> <span className="max-[380px]:hidden">Filters</span>
                                {activeCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--brand)] px-1 text-[11px] font-bold text-[var(--bi)]">{activeCount}</span>}
                            </button>
                        </div>
                    </div>

                    <div className={`${wrap} pt-5 sm:pt-6`}>
                        <SectorTabs value={f.sector} onChange={setSector} counts={sectorCounts} />

                        {/* phones: one-tap category row, since the full filter list is in the sheet */}
                        {cats.length > 1 && (
                            <div className="noscroll -mx-4 mt-3 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 lg:hidden" role="group" aria-label="Quick category filter">
                                <button type="button" aria-pressed={f.cat === "all"} onClick={() => setKey("cat")("all")} className={chip(f.cat === "all")}>All</button>
                                {cats.map((c) => {
                                    const n = fc("cat", c);
                                    return (
                                        <button key={c} type="button" aria-pressed={f.cat === c} disabled={n === 0 && f.cat !== c}
                                            onClick={() => setKey("cat")(f.cat === c ? "all" : c)}
                                            className={`${chip(f.cat === c)} disabled:opacity-40`}>
                                            {c} <span className="opacity-60">{n}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[256px_1fr] lg:gap-10">
                            {/* Filters: sidebar on desktop, bottom sheet on phones */}
                            {panel && <div onClick={() => setPanel(false)} aria-hidden="true" className="fi fixed inset-0 z-[55] bg-[rgba(5,8,15,.55)] lg:hidden" />}
                            <aside aria-label="Filters" role={panel ? "dialog" : undefined} aria-modal={panel ? "true" : undefined}
                                className={`${panel ? "sheet fixed inset-x-0 bottom-0 z-[60] flex max-h-[88dvh] flex-col rounded-t-3xl border-x-0 border-b-0 shadow-[0_-20px_50px_-20px_rgba(0,0,0,.5)]" : "hidden"} border border-[var(--line)] bg-[var(--surface)] lg:static lg:z-auto lg:flex lg:[animation:rise_.55s_var(--ease)_both] lg:flex-col lg:rounded-2xl lg:border lg:shadow-[var(--sh1)]`}>
                                <div aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 flex-none rounded-full bg-[var(--line2)] lg:hidden" />
                                <div className="flex flex-none items-center justify-between border-b border-[var(--line)] px-4 pb-3 pt-3 lg:pt-4">
                                    <span className="inline-flex items-center gap-2.5">
                                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--soft)] text-[var(--brand)]"><IFilter /></span>
                                        <b className="text-[15px]">Filters</b>
                                        {activeCount > 0 && <span key={activeCount} className="pop grid h-5 min-w-5 place-items-center rounded-full bg-[var(--brand)] px-1.5 text-[11px] font-bold text-[var(--bi)]">{activeCount}</span>}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {dirty && (
                                            <button type="button" onClick={resetAll}
                                                className="inline-flex min-h-[36px] cursor-pointer items-center gap-1 border-0 bg-transparent px-1 text-[13px] font-semibold text-[var(--brand)] hover:underline">
                                                <IX /> Clear all
                                            </button>
                                        )}
                                        <button type="button" onClick={() => setPanel(false)} aria-label="Close filters"
                                            className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-0 bg-[var(--sunken)] text-[var(--ink)] lg:hidden"><IX size={16} /></button>
                                    </div>
                                </div>
                                <div className="min-h-0 flex-1 px-4 pb-4 pt-4 max-lg:pt-1">{filters}</div>
                                <div className="flex-none border-t border-[var(--line)] bg-[var(--surface)] p-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] lg:hidden">
                                    <button type="button" onClick={() => setPanel(false)} className={`${btn} ${btnBrand} !min-h-[50px] w-full !text-[15px]`}>
                                        Show <span key={rows.length} className="pop inline-block tabular-nums">{rows.length}</span> {rows.length === 1 ? "job" : "jobs"}
                                    </button>
                                </div>
                            </aside>

                            {/* Results */}
                            <div className="min-w-0">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                                    <p aria-live="polite" className="m-0 text-sm text-[var(--mute)]">
                                        {jobs ? (
                                            <>Showing <b className="text-[var(--ink)]">{shown.length}</b> of <b className="text-[var(--ink)]">{rows.length}</b> {rows.length === 1 ? "job" : "jobs"}
                                                {f.saved && " you saved"}</>
                                        ) : "Loading jobs…"}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <label className="text-[13px] font-medium text-[var(--faint)] max-sm:sr-only" htmlFor="sort">Sort by</label>
                                        <select id="sort" value={sortValue} onChange={(e) => setSort(e.target.value)} className={selectCls}>
                                            {sortOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {chips.length > 0 && (
                                    <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
                                        {chips.map(([k, l]) => (
                                            <button key={k} type="button" onClick={() => setKey(k)(DEFAULTS[k])} aria-label={`Remove filter ${l}`}
                                                className="chipin group inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-full border border-[var(--line2)] bg-[var(--surface)] py-1 pl-3 pr-2 text-[13px] font-semibold text-[var(--ink)] transition hover:border-[var(--ink)]">
                                                <span className="max-w-[22ch] truncate">{l}</span>
                                                <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--sunken)] text-[var(--mute)] transition duration-200 group-hover:rotate-90 group-hover:bg-[var(--badbg)] group-hover:text-[var(--bad)]"><IX size={11} /></span>
                                            </button>
                                        ))}
                                        {chips.length > 1 && (
                                            <button type="button" onClick={resetAll} className="min-h-[34px] cursor-pointer border-0 bg-transparent px-1 text-[13px] font-semibold text-[var(--brand)] hover:underline">Clear all</button>
                                        )}
                                    </div>
                                )}

                                <div className="mb-5 flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--warn)_28%,var(--line))] bg-[var(--warnbg)] px-4 py-3 text-[13px] text-[var(--warn)]">
                                    <span className="mt-px"><IInfo /></span>
                                    <span>Links can expire quickly. Apply as soon as you can, and check our latest Instagram posts if a link no longer works.</span>
                                </div>

                                <div className="grid gap-3">
                                    {!jobs ? (
                                        [0, 1, 2].map((i) => <div key={i} className="sk h-[230px] rounded-2xl" />)
                                    ) : shown.length ? (
                                        shown.map((j, i) => (
                                            <JobRow key={slug(j)} j={j} i={i % PAGE} tk={tk} saved={savedSet.has(slug(j))} onSave={toggleSave} />
                                        ))
                                    ) : f.saved && !f.q.trim() && savedCount === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-[var(--line2)] bg-[var(--surface)] px-4 py-14 text-center text-[var(--mute)]">
                                            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-[var(--sunken)] text-[var(--brand)]"><IBookmark on={false} size={22} /></div>
                                            <b className="serif block text-xl text-[var(--ink)]">No saved jobs yet</b>
                                            <p className="mx-auto mb-5 mt-1.5 max-w-[42ch] text-sm">Tap the bookmark on any job to keep it here. Saved jobs stay on this device.</p>
                                            <button type="button" onClick={() => setKey("saved")(false)} className={`${btn} ${btnDark}`}>Browse all jobs</button>
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-[var(--line2)] bg-[var(--surface)] px-4 py-12 text-center text-[var(--mute)] sm:py-14">
                                            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-[var(--sunken)] text-[var(--brand)]"><ISearch size={22} /></div>
                                            <b className="serif block text-xl text-[var(--ink)]">No jobs match{f.q.trim() ? ` “${f.q.trim()}”` : " your filters"}</b>
                                            <p className="mx-auto mb-5 mt-1.5 max-w-[44ch] text-sm">
                                                {looseCount > 0 && dirty
                                                    ? `${looseCount} open ${looseCount === 1 ? "job matches" : "jobs match"} your words if you remove the filters.`
                                                    : "Check the spelling, or try a role, company or city instead."}
                                            </p>
                                            <div className="flex flex-wrap items-center justify-center gap-2">
                                                {dirty && <button type="button" onClick={resetAll} className={`${btn} ${btnDark}`}>{looseCount > 0 ? `Show ${looseCount} ${looseCount === 1 ? "job" : "jobs"}` : "Clear filters"}</button>}
                                                {looseCount === 0 && popular.slice(0, 3).map((p) => (
                                                    <button key={p.label} type="button" onClick={() => setF({ ...DEFAULTS, q: p.label })} className={btn}>{p.label}</button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {remaining > 0 && (
                                    <div className="mt-6 text-center">
                                        <button type="button" onClick={() => setVisible((v) => v + PAGE)} className={`${btn} !min-h-[48px] w-full sm:w-auto sm:!px-8`}>
                                            Show {Math.min(PAGE, remaining)} more <span className="text-[var(--faint)]">({remaining} left)</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ============================ JOB ALERTS ============================ */}
                {WHATSAPP_URL && (
                    <section aria-label="Job alerts" className={`${wrap} pb-14 sm:pb-20`}>
                        <div className="relative overflow-hidden rounded-2xl border border-[color-mix(in_srgb,#25D366_30%,var(--line))] bg-[var(--surface)] shadow-[var(--sh1)] sm:rounded-3xl">
                            <div aria-hidden="true" className="pointer-events-none absolute inset-0"
                                style={{ backgroundImage: "radial-gradient(55% 90% at 100% 0%,color-mix(in srgb,#25D366 16%,transparent),transparent 70%)" }} />
                            <div className="relative flex flex-col items-start gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                                <div className="flex items-start gap-4">
                                    <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white"><IWhatsApp size={26} /></span>
                                    <div>
                                        <h2 className="m-0 text-[1.15rem] font-extrabold tracking-[-.02em] sm:text-[1.3rem]">Never miss a new opening</h2>
                                        <p className="mb-0 mt-1 max-w-[52ch] text-sm text-[var(--mute)]">Get new government and private jobs on WhatsApp as soon as they are posted. Free, no spam, leave anytime.</p>
                                    </div>
                                </div>
                                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex min-h-[50px] w-full flex-none items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#25D366] to-[#128C7E] px-6 text-[15px] font-extrabold text-white no-underline shadow-[0_14px_28px_-14px_#128C7E] transition duration-200 hover:brightness-105 active:scale-[.98] sm:w-auto">
                                    <IWhatsApp size={20} /> Join WhatsApp Channel
                                </a>
                            </div>
                        </div>
                    </section>
                )}

                {/* ============================ HOW IT WORKS ============================ */}
                <section id="how" className="scroll-mt-16 border-y border-[var(--line)] bg-[var(--sunken)] py-12 sm:py-20" aria-labelledby="how-title">
                    <div className={wrap}>
                        <p className="m-0 mb-1.5 text-[11px] font-bold uppercase tracking-[.12em] text-[var(--gold)]">Process</p>
                        <h2 id="how-title" className="serif m-0 text-[clamp(1.6rem,3.6vw,2.4rem)] font-semibold tracking-[-.02em]">How {SITE_NAME} works</h2>
                        <p className="mb-8 mt-2 max-w-[56ch] text-[var(--mute)] sm:mb-10">Three simple steps from searching to applying.</p>
                        <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
                            {STEPS.map(([t, d], i) => (
                                <li key={t} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--sh1)] sm:p-6">
                                    <span style={{ backgroundImage: "linear-gradient(135deg,var(--brand),var(--brand2))" }} className="mb-4 grid h-10 w-10 place-items-center rounded-full text-sm font-extrabold text-[var(--bi)] shadow-[0_8px_18px_-8px_var(--brand)] sm:mb-5">{i + 1}</span>
                                    <b className="block text-[1.05rem] tracking-[-.01em]">{t}</b>
                                    <p className="mb-0 mt-2 text-[.94rem] text-[var(--mute)]">{d}</p>
                                </li>
                            ))}
                        </ol>
                        <p className="mb-0 mt-6 inline-flex items-center gap-2 text-[13px] font-medium text-[var(--mute)]">
                            <span className="text-[var(--brand)]"><IShield /></span> We never ask for money. Genuine employers do not charge candidates.
                        </p>
                    </div>
                </section>
            </main>

            {/* ============================== FOOTER ============================== */}
            <Footer onHome={resetAll} />

            {/* back to top */}
            <button type="button" aria-label="Back to top" tabIndex={showTop ? 0 : -1}
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className={`fixed bottom-[calc(env(safe-area-inset-bottom,0px)+16px)] right-4 z-[45] grid h-12 w-12 cursor-pointer place-items-center rounded-full border border-[var(--line2)] bg-[var(--surface)] text-[var(--ink)] shadow-[var(--sh2)] transition duration-300 hover:border-[var(--brand)] hover:text-[var(--brand)] active:scale-95 sm:bottom-6 sm:right-6 ${showTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}>
                <IUp />
            </button>
        </div>
    );
}