import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { trackClick } from "../track";
import { SITE_NAME, INSTAGRAM_HANDLE, INSTAGRAM_URL, WHATSAPP_URL } from "../site";
import { Logo, BrandMark } from "../Brand";
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

const toLocalDate = (value) => {
  if (!value) return null;
  const str = String(value).trim();

  // Treat YYYY-MM-DD as a local calendar date, not UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [year, month, day] = str.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const today = new Date();
today.setHours(0, 0, 0, 0);

const slug = (j) =>
  `${j.company}-${j.role}-${j.posted}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const expired = (j) => {
  const deadline = toLocalDate(j.deadline);
  return Boolean(deadline && deadline < today);
};

const isNew = (j) => {
  const posted = toLocalDate(j.posted);
  if (!posted) return false;
  return (today - posted) / 864e5 <= 7 && !expired(j);
};
const sectorOf = (j) =>
  j.sector
    ? /gov|psu|public|sarkari/i.test(j.sector) ? "govt" : "private"
    : /\bgovt\b|government|sarkari/i.test(j.company || "") ? "govt" : "private";
const isGovt = (j) => sectorOf(j) === "govt";
const vacLabel = (v) => (/^\d+$/.test(String(v).trim()) ? `${v} vacancies` : String(v));
const fmt = (d) => {
  const date = toLocalDate(d);
  if (!date) return "Not specified";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
const hue = (c) => {
  let h = 0;
  for (const ch of c) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
};
const monoStyle = (c) => {
  const h = hue(c);
  return { background: `hsl(${h} 85% 93%)`, color: `hsl(${h} 55% 34%)` };
};
const initials = (c) =>
  c.replace(/[^A-Za-z0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "J";
const ago = (d) => {
  const posted = toLocalDate(d);
  if (!posted) return "Posted recently";
  const n = Math.floor((today - posted) / 864e5);
  return n <= 0 ? "Posted today" : n === 1 ? "Posted yesterday" : `Posted ${n} days ago`;
};

const expText = (j) =>
  String(j.experience).trim() === "0" ? "Freshers (0 years)" : j.experience || "Not specified";

const levelText = (j) => (j.exp === "fresher" ? "Freshers can apply" : "Experienced candidates");

const timeLeft = (j) => {
  const deadline = toLocalDate(j.deadline);
  if (!deadline) {
    return { t: "Apply early, links can close any time", short: "Apply early", late: false };
  }
  const n = Math.round((deadline.getTime() - today.getTime()) / 864e5);
  if (n < 0) return { t: "Applications closed", short: "Closed", late: true };
  if (n === 0) return { t: "Last day to apply is today", short: "Last day today", late: true };
  return {
    t: `${n} day${n > 1 ? "s" : ""} left to apply`,
    short: `${n} day${n > 1 ? "s" : ""} left`,
    late: n <= 3,
  };
};
const meter = (j) => {
  const posted = toLocalDate(j.posted);
  const deadline = toLocalDate(j.deadline);
  if (!posted || !deadline) return null;
  const s = posted.getTime();
  const e = deadline.getTime();
  const p = (today.getTime() - s) / (e - s || 1);
  return Math.round(Math.min(1, Math.max(0.04, p)) * 100);
};

/* Books / offers are shown only on the jobs ticked for them in admin (o.jobIds). No category matching. */
const forJob = (j, list) =>
  list.filter((o) => o.active !== false && o.link && j.id && Array.isArray(o.jobIds) && o.jobIds.includes(j.id));
const pickOffers = (j, list) => forJob(j, list).filter((o) => o.kind !== "video");

/* YouTube: accepts watch, youtu.be, shorts, embed and live links. */
const ytId = (u) => {
  const m = String(u || "").match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "";
};
const cleanTitle = (t) => (/^https?:\/\//i.test(String(t || "").trim()) ? "" : String(t || "").trim());
const getVideos = (j) =>
  [].concat(j.videos || [], j.video || [])
    .map((v) => (typeof v === "string" ? { url: v } : v || {}))
    .map((v) => ({ id: ytId(v.url), title: cleanTitle(v.title) }))
    .filter((v) => v.id);
const pickVideos = (j, list) =>
  forJob(j, list).filter((o) => o.kind === "video").map((o) => ({ id: ytId(o.link), title: cleanTitle(o.title) })).filter((v) => v.id);

/* ------------------------------------------------------------------ */
/* Structured content helpers (all fields are optional)                */
/* ------------------------------------------------------------------ */
// one item per line; leading "-", "*" or "1." markers are removed
const lines = (v) =>
  String(v || "").split(/\r?\n/).map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim()).filter(Boolean);
// comma, semicolon or one-per-line
const tags = (v) => String(v || "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
// "A | B" per line -> [["A","B"], ...]. Only the first "|" splits, so links and text stay intact.
const cols = (v) =>
  lines(v).map((l) => {
    const i = l.indexOf("|");
    return i < 0 ? [l.trim()] : [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  });
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "");
const fmtAny = (d) => (Number.isNaN(new Date(d).getTime()) ? String(d) : fmt(d));
// "Q: question" then "A: answer" (answer may run over several lines)
const parseFaqs = (v) => {
  const out = [];
  let cur = null;
  for (const raw of String(v || "").split(/\r?\n/)) {
    const line = raw.trim();
    const q = /^q\s*[:.)]\s*(.*)$/i.exec(line);
    const a = /^a\s*[:.)]\s*(.*)$/i.exec(line);
    if (q) { cur = { q: q[1], a: "" }; out.push(cur); }
    else if (a && cur) cur.a = a[1];
    else if (line && cur) cur.a += (cur.a ? "\n" : "") + line;
  }
  return out.filter((f) => f.q && f.a);
};
/* FAQs: the ones written in admin come first. Then answers are built ONLY from fields filled in for this job
   (nothing is invented). A question is skipped when there is no data for it, or when admin already wrote one on that topic. */
const buildFaqs = (j, p, gov) => {
  const admin = parseFaqs(j.faqs);
  const covered = (re) => admin.some((f) => re.test(f.q));
  const bullets = (items) => items.map((t) => `- ${t}`).join("\n");
  const verify = "Please confirm this in the official notification before applying.";
  const auto = [];
  const add = (re, q, a) => { if (a && !covered(re)) auto.push({ q, a }); };

  add(/qualif|educational|who can apply|eligib/i,
    `What qualification is required for the ${j.role} post at ${j.company}?`,
    (j.eligibility || p.elig.length) && [
      j.eligibility && `The qualification listed for this recruitment is: ${j.eligibility}.`,
      p.elig.length && `Other eligibility points listed:\n${bullets(p.elig)}`,
      verify,
    ].filter(Boolean).join("\n\n"));

  add(/age limit|age relax|maximum age|minimum age/i, "What is the age limit?",
    (p.age.length || p.relax.length) && [
      p.age.length && `Age limit listed:\n${bullets(p.age)}`,
      p.relax.length && `Age relaxation listed:\n${bullets(p.relax)}`,
      verify,
    ].filter(Boolean).join("\n\n"));

  add(/fresher/i, `Is this ${j.role} recruitment open to freshers?`,
    `${j.exp === "fresher" ? "Yes, this listing is marked as open to freshers." : "This listing is aimed at experienced candidates."} Experience listed: ${expText(j)}. ${verify}`);

  add(/last date|deadline|closing date/i, "What is the last date to apply?",
    j.deadline && `The last date mentioned on this page is ${fmt(j.deadline)}.${j.startDate ? ` Applications open from ${fmtAny(j.startDate)}.` : ""} Dates can change, so check the official notification.`);

  add(/exam date|when is the exam/i, "When is the exam?",
    j.examDate && `The exam date listed is ${fmtAny(j.examDate)}. Check the official notification for any change.`);

  add(/salary|pay scale|stipend|\bctc\b/i, `What is the ${gov ? "pay scale" : "salary"} for this post?`,
    j.salary && `The ${gov ? "pay scale" : "salary"} listed is ${j.salary}. Please verify the exact figure in the official notification.`);

  add(/vacanc/i, "How many vacancies are there?",
    j.vacancies && `The number of vacancies listed is ${vacLabel(j.vacancies)}. ${verify}`);

  add(/how (can|do|to|should)\b.*\bapply|application process|steps to apply/i, `How can I apply for the ${j.role} post?`,
    p.howTo.length
      ? `The steps listed for this recruitment are:\n${bullets(p.howTo.map(([t, d]) => (d ? `${t}: ${d}` : t)))}`
      : j.link && "Applications are submitted through the official link given on this page.");

  add(/\bfee\b/i, "Is there an application fee?",
    j.fee && `The fee details listed are:\n${bullets(lines(j.fee).map((l) => l.replace(/\s*\|\s*/, ": ")))}\n\n${verify}`);

  add(/document/i, "What documents are required?",
    p.docs.length && `The documents listed are:\n${bullets(p.docs)}\n\nThe official notification may list more.`);

  add(/selection|exam pattern|selected/i, "What is the selection process?",
    p.selection.length && `The stages listed, in order, are:\n${p.selection.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\nRefer to the official notification for the exact procedure.`);

  add(/affiliat|official .*website|independent/i, `Is ${SITE_NAME} affiliated with ${j.company}?`,
    `No. ${SITE_NAME} is an independent job-information platform and is not affiliated with ${j.company}. Always apply through the official link and verify the details in the official notification.`);

  return [...admin, ...auto];
};

const parts = (j) => {
  const p = {
    resp: lines(j.responsibilities),
    elig: lines(j.eligibilityPoints),
    skills: tags(j.skills),
    selection: lines(j.selection),
    docs: lines(j.documents),
    notification: safeUrl(j.notification),
    // "Post name | 216" per line
    vac: cols(j.vacancyTable).filter((r) => r.length >= 2 && r[0]),
    age: lines(j.ageLimit),
    relax: lines(j.ageRelaxation),
    // "Category | Fee" per line. Plain text such as "Free" falls back to normal text.
    feeRows: cols(j.fee).filter((r) => r.length >= 2 && r[0]),
    // "Label | https://link" per line
    links: cols(j.importantLinks).map(([l, u]) => [l, safeUrl(u)]).filter(([l, u]) => l && u),
    howTo: lines(j.howToApply).map((t) => {
      const i = t.indexOf(":");
      return i > 0 && i < 60 ? [t.slice(0, i).trim(), t.slice(i + 1).trim()] : [t, ""];
    }),
    dates: [
      j.posted && { k: "notif", label: "Notification date", v: j.posted },
      j.startDate && { k: "start", label: "Application start", v: j.startDate },
      j.deadline && { k: "last", label: "Last date to apply", v: j.deadline },
      j.feeDate && { k: "fee", label: "Fee payment last date", v: j.feeDate },
      (j.examDate || isGovt(j)) && { k: "exam", label: "Exam date", v: j.examDate || "To be announced" },
    ].filter(Boolean),
  };
  // eligibility has its own section now, so it no longer counts towards the description card
  p.hasDesc = !!(j.description || p.resp.length || p.skills.length);
  p.faqs = buildFaqs(j, p, isGovt(j));
  return p;
};

/* ------------------------------------------------------------------ */
/* SEO: meta description + JobPosting structured data                  */
/* ------------------------------------------------------------------ */
const plain = (t) => String(t || "").replace(/[#*`]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();
// A job page needs a written "About" plus at least this many filled sections to be indexed. Lower it if you want more pages indexed.
const MIN_DEPTH = 5;
const EMP_TYPE = { "Full-Time": "FULL_TIME", "Part-Time": "PART_TIME", Internship: "INTERN", Contract: "CONTRACTOR" };

/* ------------------------------------------------------------------ */
/* Theme tokens + animations                                           */
/* Only transform and opacity are animated, so everything stays on the */
/* GPU and scrolling never janks. Blur is used on large screens only.  */
/* ------------------------------------------------------------------ */
const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap");
:root{--bg:#f6f7fb;--card:#fff;--ink:#0b1220;--mute:#5b677f;--line:#e5e8f0;--brand:#4f46e5;--brand2:#2563eb;--bi:#fff;--soft:#f0f2ff;
--ok:#047857;--okbg:#dcfce7;--warn:#b45309;--warnbg:#fef3c7;
--ease:cubic-bezier(.22,1,.36,1);
--shadow:0 1px 2px rgba(11,18,32,.04),0 8px 24px -14px rgba(11,18,32,.16);
--shadow2:0 2px 6px rgba(11,18,32,.06),0 22px 44px -18px rgba(79,70,229,.32)}
:root[data-theme="dark"]{--bg:#080b12;--card:#10151f;--ink:#eef1f8;--mute:#a3adc2;--line:#212939;--brand:#8c8fff;--brand2:#6ea0ff;--bi:#0a0d14;--soft:#192038;
--ok:#4ade80;--okbg:#10301f;--warn:#fbbf24;--warnbg:#3a2a0a;
--shadow:0 1px 2px rgba(0,0,0,.4),0 10px 28px -14px rgba(0,0,0,.75);
--shadow2:0 2px 6px rgba(0,0,0,.5),0 22px 44px -18px rgba(140,143,255,.34)}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%;overflow-x:clip}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow-x:clip;overflow-wrap:break-word;-webkit-tap-highlight-color:transparent}
img{max-width:100%}
::selection{background:var(--brand);color:var(--bi)}
:focus-visible{outline:3px solid color-mix(in srgb,var(--brand) 70%,transparent);outline-offset:2px}
button,a{touch-action:manipulation}

@keyframes fu{from{opacity:0;transform:translate3d(0,14px,0)}to{opacity:1;transform:none}}
@keyframes fi{from{opacity:0}to{opacity:1}}
@keyframes shimmer{to{background-position:-200% 0}}
@keyframes ping{0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}100%{box-shadow:0 0 0 9px rgba(34,197,94,0)}}
@keyframes float{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(30px,-20px,0) scale(1.1)}}
@keyframes bob{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-4px,0)}}
@keyframes nudge{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(4px,0,0)}}
@keyframes growx{from{transform:scaleX(0)}}
@keyframes pop{0%{opacity:0;transform:scale(.94) translate3d(0,8px,0)}100%{opacity:1;transform:none}}
@keyframes tick{0%{transform:scale(0) rotate(-40deg)}70%{transform:scale(1.2) rotate(6deg)}100%{transform:scale(1) rotate(0)}}
@keyframes shine{0%{transform:translate3d(-120%,0,0) skewX(-20deg)}60%,100%{transform:translate3d(320%,0,0) skewX(-20deg)}}
@keyframes sheet{from{transform:translate3d(0,100%,0)}to{transform:none}}

.fu{animation:fu .55s var(--ease) backwards;animation-delay:var(--d,0s)}
.fi{animation:fi .3s ease-out both}
.live{animation:ping 2s infinite}
.sk{background:linear-gradient(90deg,var(--line) 0,var(--soft) 50%,var(--line) 100%);background-size:200% 100%;animation:shimmer 1.3s infinite}
.noscroll{scrollbar-width:none}.noscroll::-webkit-scrollbar{display:none}

/* section reveal: short, one-time, transform + opacity only */
.rv{opacity:0;transform:translate3d(0,18px,0);transition:opacity .5s var(--ease),transform .5s var(--ease);transition-delay:var(--d,0s)}
.rv.in{opacity:1;transform:none}

/* children of a revealed block appear one after another (cap keeps it quick) */
.stg>*{opacity:0}
.rv.in .stg>*,.stg.go>*{animation:fu .45s var(--ease) both;animation-delay:calc(min(var(--i,0),9)*45ms + 80ms)}

/* little accent line that draws itself under each section title */
.ttl-bar{display:block;height:3px;width:34px;margin-top:10px;border-radius:99px;background:linear-gradient(90deg,var(--brand),var(--brand2));transform:scaleX(0);transform-origin:left}
.rv.in .ttl-bar{animation:growx .6s var(--ease) .15s both}

.blob{animation:float 12s ease-in-out infinite;will-change:transform}
.blob2{animation:float 16s ease-in-out -4s infinite reverse;will-change:transform}
.bob{animation:bob 5s ease-in-out infinite}
.nudge{animation:nudge 1.2s ease-in-out infinite}
.growx{transform-origin:left;animation:growx 1s var(--ease) .3s backwards}
.pop{animation:pop .4s var(--ease) backwards}
.tick{animation:tick .4s var(--ease) both}
.sheet{animation:sheet .4s var(--ease) both}
.shine::after{content:"";position:absolute;inset:0;width:40%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent);animation:shine 3.6s ease-in-out infinite;pointer-events:none}

/* frosted bars: blur only on large screens (it is expensive on phones) */
.glass{background:color-mix(in srgb,var(--card) 97%,transparent)}
@media (min-width:1024px){.glass{background:color-mix(in srgb,var(--card) 84%,transparent);-webkit-backdrop-filter:saturate(1.4) blur(14px);backdrop-filter:saturate(1.4) blur(14px)}}

/* FAQ open animation */
details>.faq-body{animation:fu .35s var(--ease) both}

/* phones: calmer. Drop endless decorative loops and big movement */
@media (max-width:639px){
  .bob{animation:none}
  .rv{transform:translate3d(0,12px,0);transition-duration:.4s}
}

/* hover effects only where a real hover exists, so touch screens never get stuck states */
@media (hover:none){.hov-lift:hover{transform:none!important}}

@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  *,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}
  .rv,.stg>*{opacity:1!important;transform:none!important}
}
`;

/* ------------------------------------------------------------------ */
/* Style helpers                                                       */
/* ------------------------------------------------------------------ */
const btn =
  "inline-flex min-h-[44px] cursor-pointer select-none items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-2 text-sm font-bold text-[var(--ink)] no-underline transition duration-200 hover:border-[color-mix(in_srgb,var(--brand)_55%,var(--line))] hover:text-[var(--brand)] active:scale-[.97]";
const btnPrimary =
  "group !border-transparent !text-[var(--bi)] shadow-[0_8px_20px_-8px_var(--brand)] hover:!text-[var(--bi)] hover:brightness-110";
const gradBg = { backgroundImage: "linear-gradient(135deg,var(--brand),var(--brand2))" };
const card = "mb-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-[var(--shadow)] sm:mb-5 sm:rounded-[20px] sm:p-6 lg:p-7";
const inner = "mx-auto max-w-[1200px] px-4 sm:px-[clamp(16px,3vw,36px)]";
const arrowBtn =
  "grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] transition duration-200 hover:border-[var(--brand)] hover:text-[var(--brand)] hover:shadow-[var(--shadow)] active:scale-95";
const linkCls = "font-bold text-[var(--brand)] underline underline-offset-2";
const bodyText = "text-[color-mix(in_srgb,var(--ink)_90%,var(--mute))]";

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */
const Ico = ({ children, size = 18, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`flex-none ${className}`}>
    {children}
  </svg>
);
const IPin = ({ size }) => <Ico size={size}><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></Ico>;
const ICap = ({ size }) => <Ico size={size}><path d="m2 9 10-5 10 5-10 5z" /><path d="M6 11v5c3 2.5 9 2.5 12 0v-5" /></Ico>;
const IBag = ({ size }) => <Ico size={size}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></Ico>;
const ICal = ({ size }) => <Ico size={size}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Ico>;
const IUser = ({ size }) => <Ico size={size}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></Ico>;
const IUsers = ({ size }) => <Ico size={size}><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.4c1.8.8 3 2.7 3 5.6" /></Ico>;
const IWallet = ({ size }) => <Ico size={size}><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M16 15h2" /></Ico>;
const ITag = ({ size }) => <Ico size={size}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></Ico>;
const IClock = ({ size }) => <Ico size={size}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Ico>;
const IShield = ({ size }) => <Ico size={size}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></Ico>;
const IWhatsApp = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="flex-none">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);
const IInsta = ({ size = 18 }) => (
  <Ico size={size}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r=".6" fill="currentColor" />
  </Ico>
);
const IArrow = () => <Ico size={16} className="nudge"><path d="M5 12h14M13 6l6 6-6 6" /></Ico>;
const IShare = () => <Ico size={16}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></Ico>;
const ICopy = () => <Ico size={16}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></Ico>;
const ICheck = ({ className = "" }) => <Ico size={16} className={className}><path d="m5 12 5 5 9-10" /></Ico>;
const IChevL = () => <Ico size={18}><path d="m15 6-6 6 6 6" /></Ico>;
const IChevR = () => <Ico size={18}><path d="m9 6 6 6-6 6" /></Ico>;
const IUp = () => <Ico size={18}><path d="M12 19V5M5 12l7-7 7 7" /></Ico>;

/* ------------------------------------------------------------------ */
/* Motion helpers                                                      */
/* ------------------------------------------------------------------ */

/** True only on devices with a real mouse or pen (so tilt and spotlight never run on phones). */
const canHover = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(hover:hover) and (pointer:fine)").matches;

/** Fades and slides its content in once it scrolls into view. `d` is the delay in seconds. */
function Reveal({ as: T = "div", d = 0, className = "", style, children, ...rest }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => {
      // also reveal anything already scrolled past (e.g. after jumping to an anchor)
      if (e.isIntersecting || e.boundingClientRect.top < 0) { setSeen(true); io.disconnect(); }
    }, { threshold: 0.06, rootMargin: "0px 0px -6% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <T ref={ref} className={`rv ${seen ? "in" : ""} ${className}`} style={{ "--d": `${d}s`, ...style }} {...rest}>
      {children}
    </T>
  );
}

/** Card that leans toward the pointer. Mouse only, throttled with requestAnimationFrame. */
function Tilt({ className = "", children }) {
  const ref = useRef(null);
  const raf = useRef(0);
  const enabled = useRef(false);
  useEffect(() => { enabled.current = canHover(); }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const move = (e) => {
    if (!enabled.current || e.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const x = (clientX - r.left) / r.width - 0.5;
      const y = (clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(700px) rotateX(${-y * 7}deg) rotateY(${x * 7}deg) translate3d(0,-3px,0)`;
    });
  };
  const leave = () => {
    cancelAnimationFrame(raf.current);
    if (ref.current) ref.current.style.transform = "";
  };
  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave}
      className={`hov-lift transition-[transform,box-shadow,border-color] duration-200 ease-out ${className}`}>
      {children}
    </div>
  );
}

/** Lock page scroll and close on Escape while a pop-up is open. */
function useModal(open, close) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, close]);
}

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */
const Mono = ({ company, className = "h-10 w-10 rounded-xl text-[15px]" }) => (
  <div style={monoStyle(company)} aria-hidden="true"
    className={`grid flex-none place-items-center font-extrabold tracking-[-.02em] ${className}`}>
    {initials(company)}
  </div>
);

/** Job thumbnail (set in admin). Falls back to the initials badge when empty or broken. */
function Thumb({ job, className }) {
  const [bad, setBad] = useState(false);
  useEffect(() => { setBad(false); }, [job.thumbnail]);
  if (!job.thumbnail || bad) return <Mono company={job.company} className={className} />;
  return (
    <img src={job.thumbnail} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
      onError={() => setBad(true)}
      className={`flex-none bg-[var(--soft)] object-cover ${className}`} />
  );
}

/** Big thumbnail banner at the top of the job page. Click to enlarge. Renders nothing if there is no image. */
function Banner({ job }) {
  const [bad, setBad] = useState(false);
  const [zoom, setZoom] = useState(false);
  const close = useCallback(() => setZoom(false), []);
  useEffect(() => { setBad(false); setZoom(false); }, [job.thumbnail]);
  useModal(zoom, close);

  if (!job.thumbnail || bad) return null;
  const alt = `${job.role} at ${job.company}`;

  return (
    <>
      <div className="fu relative w-full flex-none overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--soft)] shadow-[var(--shadow2)] max-lg:order-first sm:rounded-[24px] lg:w-[460px] xl:w-[500px]">
        {/* blurred copy fills the sides so any image shape looks intentional (large screens only, blur is costly on phones) */}
        <img src={job.thumbnail} alt="" aria-hidden="true" referrerPolicy="no-referrer"
          className="pointer-events-none absolute inset-0 hidden h-full w-full scale-125 object-cover opacity-25 blur-2xl lg:block" />
        <button type="button" onClick={() => setZoom(true)} aria-label={`Enlarge image: ${alt}`}
          className="group relative block h-[200px] w-full cursor-zoom-in border-0 bg-transparent p-0 min-[420px]:h-[240px] sm:h-[300px] lg:h-[340px]">
          <img src={job.thumbnail} alt={alt} decoding="async" referrerPolicy="no-referrer" onError={() => setBad(true)}
            className="relative h-full w-full object-contain p-2 transition-transform duration-500 group-hover:scale-[1.02] sm:p-4" />
          <span className="absolute bottom-3 right-3 rounded-full bg-black/45 px-3 py-1 text-xs font-bold text-white">
            Tap to enlarge
          </span>
        </button>
      </div>

      {zoom && (
        <div role="dialog" aria-modal="true" aria-label={alt} onClick={close}
          className="fi fixed inset-0 z-[80] grid cursor-zoom-out place-items-center bg-[rgba(5,8,15,.92)] p-3 sm:p-4">
          <button type="button" onClick={close} aria-label="Close image"
            className="absolute right-3 top-[max(12px,env(safe-area-inset-top,0px))] grid h-11 w-11 cursor-pointer place-items-center rounded-full border-0 bg-white/15 text-lg text-white transition hover:bg-white/25 sm:right-4 sm:top-4">✕</button>
          <img src={job.thumbnail} alt={alt} referrerPolicy="no-referrer" onClick={(e) => e.stopPropagation()}
            className="pop max-h-[86dvh] max-w-full rounded-xl object-contain shadow-2xl" />
        </div>
      )}
    </>
  );
}

const Badge = ({ kind, children }) => {
  const c =
    kind === "new" ? "bg-[var(--okbg)] text-[var(--ok)]"
      : kind === "exp" ? "bg-[var(--warnbg)] text-[var(--warn)]"
        : kind === "pvt" ? "bg-[var(--line)] text-[var(--mute)]"
          : "bg-[var(--soft)] text-[var(--brand)]";
  return <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${c}`}>{children}</span>;
};

const SectionTitle = ({ eyebrow, children, sub }) => (
  <div className="mb-4 sm:mb-5">
    {eyebrow && <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-[.14em] text-[var(--brand)] sm:text-[11px]">{eyebrow}</div>}
    <h2 className="m-0 text-[1.15rem] font-extrabold leading-tight tracking-[-.02em] sm:text-[1.28rem]">{children}</h2>
    <i aria-hidden="true" className="ttl-bar" />
    {sub && <p className="mb-0 mt-2.5 max-w-[70ch] text-[13.5px] leading-relaxed text-[var(--mute)] sm:text-sm">{sub}</p>}
  </div>
);

/** Inline **bold**, `code` and [text](https://link). Everything else stays plain text. */
const inline = (text, key) => {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let last = 0;
  let m;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${n++}`;
    if (t.startsWith("**")) out.push(<strong key={k} className="font-extrabold text-[var(--ink)]">{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k} className="rounded bg-[var(--soft)] px-1.5 py-0.5 text-[.92em]">{t.slice(1, -1)}</code>);
    else {
      const mm = /^\[([^\]]+)\]\((.+)\)$/.exec(t);
      out.push(<a key={k} href={mm[2]} target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--brand)] underline underline-offset-2">{mm[1]}</a>);
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

/** Small, safe markdown: # headings, - or * bullets, 1. lists, blank-line paragraphs. */
function Md({ text }) {
  const blocks = [];
  let ul = null;
  let ol = null;
  let para = [];
  const flush = () => {
    if (para.length) { blocks.push({ t: "p", v: para.join(" ") }); para = []; }
    if (ul) { blocks.push({ t: "ul", v: ul }); ul = null; }
    if (ol) { blocks.push({ t: "ol", v: ol }); ol = null; }
  };
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    let m;
    if (!line) { flush(); continue; }
    if ((m = /^#{1,6}\s+(.*)$/.exec(line))) { flush(); blocks.push({ t: "h", v: m[1] }); continue; }
    if ((m = /^[-*•]\s+(.*)$/.exec(line))) { if (para.length || ol) flush(); if (!ul) ul = []; ul.push(m[1]); continue; }
    if ((m = /^\d+[.)]\s+(.*)$/.exec(line))) { if (para.length || ul) flush(); if (!ol) ol = []; ol.push(m[1]); continue; }
    if (ul || ol) flush();
    para.push(line);
  }
  flush();
  const body = `text-[.98rem] leading-[1.75] ${bodyText} sm:text-[1.02rem] sm:leading-[1.8]`;
  return (
    <div className="max-w-[75ch]">
      {blocks.map((b, i) =>
        b.t === "h" ? <h3 key={i} className="mb-2 mt-6 text-[1.02rem] font-extrabold tracking-[-.01em] first:mt-0">{inline(b.v, i)}</h3>
          : b.t === "ul" ? <ul key={i} className={`mb-3 mt-0 list-disc pl-5 marker:text-[var(--brand)] ${body}`}>{b.v.map((x, k) => <li key={k} className="pl-1">{inline(x, `${i}-${k}`)}</li>)}</ul>
            : b.t === "ol" ? <ol key={i} className={`mb-3 mt-0 list-decimal pl-5 marker:font-bold marker:text-[var(--brand)] ${body}`}>{b.v.map((x, k) => <li key={k} className="pl-1">{inline(x, `${i}-${k}`)}</li>)}</ol>
              : <p key={i} className={`mb-3 mt-0 last:mb-0 ${body}`}>{inline(b.v, i)}</p>
      )}
    </div>
  );
}

/** A page section card. */
const Block = ({ id, eyebrow, title, sub, children }) => (
  <Reveal as="section" id={id} className={`${card} job-section scroll-mt-[8.5rem] lg:scroll-mt-[9rem]`}>
    <SectionTitle eyebrow={eyebrow} sub={sub}>{title}</SectionTitle>
    {children}
  </Reveal>
);

const SubHead = ({ children }) => <h3 className="mb-3 mt-0 text-[1.02rem] font-extrabold tracking-[-.01em]">{children}</h3>;

/** Simple data table. rows: [{ cells: [...], total?: true }]. Scrolls sideways on narrow screens. */
const Table = ({ head, rows }) => (
  <div className="noscroll overflow-x-auto overscroll-x-contain rounded-2xl border border-[var(--line)]">
    <table className="w-full min-w-[280px] border-collapse text-left text-[.92rem] sm:text-[.95rem]">
      <thead className="bg-[var(--soft)]">
        <tr>{head.map((h) => <th key={h} scope="col" className="px-3.5 py-3 font-extrabold sm:px-4">{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={`border-t border-[var(--line)] transition-colors hover:bg-[var(--bg)] ${r.total ? "bg-[var(--soft)] font-extrabold" : ""}`}>
            {r.cells.map((c, k) => <td key={k} className="px-3.5 py-3 align-top font-semibold sm:px-4">{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/** Bullet list with a tick in front of every item. Items fade in one after another. */
const Ticks = ({ items }) => (
  <ul className="stg m-0 grid list-none gap-2.5 p-0">
    {items.map((t, i) => (
      <li key={i} style={{ "--i": i }} className={`flex items-start gap-3 text-[.96rem] leading-snug sm:text-base ${bodyText}`}>
        <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-[var(--soft)] text-[var(--brand)]"><ICheck /></span>
        <span className="min-w-0 pt-0.5">{t}</span>
      </li>
    ))}
  </ul>
);

/** Full-width section with a horizontally scrolling row and prev/next arrows. */
function Rail({ id, eyebrow, title, sub, children }) {
  const ref = useRef(null);
  const go = (d) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: d * Math.max(260, el.clientWidth * 0.8), behavior: "smooth" });
  };
  return (
    <Reveal as="section" id={id} className={`${card} scroll-mt-[8.5rem] lg:scroll-mt-[9rem]`}>
      <div className="flex items-end justify-between gap-4">
        <SectionTitle eyebrow={eyebrow} sub={sub}>{title}</SectionTitle>
        <div className="mb-5 flex flex-none gap-2 max-sm:hidden">
          <button type="button" className={arrowBtn} onClick={() => go(-1)} aria-label="Scroll left"><IChevL /></button>
          <button type="button" className={arrowBtn} onClick={() => go(1)} aria-label="Scroll right"><IChevR /></button>
        </div>
      </div>
      <div ref={ref} className="noscroll -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-3 pt-1 sm:-mx-1 sm:scroll-px-1 sm:gap-4 sm:px-1">
        {children}
      </div>
    </Reveal>
  );
}

/** Book / course tile. */
const OfferCard = ({ o }) => (
  <a href={o.link} target="_blank" rel="sponsored noopener noreferrer"
    className="hov-lift group flex h-full w-[148px] flex-none flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] no-underline transition duration-300 hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--brand)_45%,var(--line))] hover:shadow-[var(--shadow2)] active:scale-[.98] sm:w-[184px]">
    <span className="relative block aspect-[3/4] w-full overflow-hidden bg-[var(--soft)]">
      {o.image
        ? <img src={o.image} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-contain p-2 transition-transform duration-500 group-hover:scale-[1.06]" />
        : <span className="absolute inset-0 grid place-items-center text-4xl">📘</span>}
    </span>
    <span className="flex flex-1 flex-col gap-1 p-3 sm:p-3.5">
      <b className="line-clamp-2 text-[.86rem] leading-snug text-[var(--ink)] sm:text-[.9rem]">{o.title}</b>
      <span className="mt-auto inline-flex items-center gap-1 pt-2 text-[13px] font-bold text-[var(--brand)]">
        {o.cta || "View offer"} <span className="transition-transform group-hover:translate-x-1">→</span>
      </span>
    </span>
  </a>
);

/** Videos: horizontal row of tiles, pop-up player (bottom sheet feel on phones). */
function VideoSection({ videos }) {
  const [active, setActive] = useState(null);
  const close = useCallback(() => setActive(null), []);
  useModal(!!active, close);

  return (
    <>
      <Rail id="videos" eyebrow="Watch" title="Watch &amp; prepare"
        sub="These videos are included to help you understand the exam pattern and prepare for this recruitment. They are not produced by the recruiting organization. Tap a video to play it.">
        {videos.map((v, n) => (
          <Reveal key={v.id} d={Math.min(n, 4) * 0.06} className="flex-none snap-start">
            <button type="button" onClick={() => setActive(v)}
              className="hov-lift group flex h-full w-[240px] cursor-pointer flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] p-0 text-left transition duration-300 hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--brand)_45%,var(--line))] hover:shadow-[var(--shadow2)] active:scale-[.98] sm:w-[300px]">
              <span className="relative block aspect-video w-full overflow-hidden bg-black">
                <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
                <span className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/45 to-transparent transition group-hover:from-black/60">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-white/95 text-[#e11d2e] shadow-xl transition duration-300 group-hover:scale-110">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                  </span>
                </span>
              </span>
              <span className="flex flex-1 flex-col gap-1 p-3 sm:p-3.5">
                <b className="line-clamp-2 text-[.9rem] leading-snug sm:text-[.92rem]">{v.title || "Watch this video"}</b>
                <span className="mt-auto inline-flex items-center gap-1 pt-2 text-[13px] font-bold text-[var(--brand)]">
                  Play video <span className="transition-transform group-hover:translate-x-1">→</span>
                </span>
              </span>
            </button>
          </Reveal>
        ))}
      </Rail>

      {active && (
        <div role="dialog" aria-modal="true" aria-label={active.title || "Video"} onClick={close}
          className="fi fixed inset-0 z-[70] grid place-items-center bg-[rgba(5,8,15,.88)] p-3 sm:p-4">
          <div onClick={(e) => e.stopPropagation()} className="pop w-full max-w-[900px]">
            <div className="mb-3 flex items-center justify-between gap-3 text-white">
              <b className="min-w-0 truncate">{active.title || "Video"}</b>
              <button type="button" onClick={close} aria-label="Close video"
                className="grid h-11 w-11 flex-none cursor-pointer place-items-center rounded-full border-0 bg-white/15 text-lg text-white transition hover:bg-white/25">✕</button>
            </div>
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl">
              <iframe className="absolute inset-0 h-full w-full border-0"
                src={`https://www.youtube-nocookie.com/embed/${active.id}?autoplay=1&rel=0`}
                title={active.title || "Video"} allowFullScreen
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Nav({ dark, setDark }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 20);
        ticking = false;
      });
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const small = `${btn} !min-h-0 !h-10 !px-3 !py-1.5 sm:!px-3.5`;

  return (
    <nav aria-label="Main"
      className="glass sticky top-0 z-40 border-b border-[var(--line)] pt-[env(safe-area-inset-top,0px)]">
      {/* Fixed navbar height, never animated */}
      <div className={`${inner} relative flex h-16 items-center justify-between gap-2 sm:gap-3`}>
        <Link to="/" aria-label={`${SITE_NAME} home`} className="relative flex h-12 min-w-0 items-center no-underline">
          <span className={`block origin-left transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] max-[380px]:scale-[0.85] ${scrolled ? "scale-[0.82]" : "scale-100"}`}>
            <Logo size={46} text="text-[22px]" />
          </span>
        </Link>

        <ul className="m-0 flex list-none items-center gap-1 p-0 sm:gap-1.5">
          <li className="max-md:hidden">
            <Link to="/" className="inline-block rounded-lg px-3.5 py-2 text-sm font-semibold text-[var(--mute)] no-underline transition-colors duration-200 hover:bg-[var(--soft)] hover:text-[var(--brand)]">
              Home
            </Link>
          </li>
          <li className="max-md:hidden">
            <a href="/#jobs" className="inline-block rounded-lg px-3.5 py-2 text-sm font-semibold text-[var(--mute)] no-underline transition-colors duration-200 hover:bg-[var(--soft)] hover:text-[var(--brand)]">
              All jobs
            </a>
          </li>
          <li>
            <NotifyButton className={small} />
          </li>
          <li>
            <button type="button" onClick={() => setDark((d) => !d)} aria-label="Switch light or dark mode" className={small}>
              <span aria-hidden="true">{dark ? "☀️" : "🌙"}</span>
              <span className="max-sm:hidden">{dark ? "Light" : "Dark"}</span>
            </button>
          </li>
          <li className="max-md:hidden">
            <a className={`${btn} ${btnPrimary} !min-h-0 !h-10 !px-4 !py-1.5`} style={gradBg}
              href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
              Follow on Instagram
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}

const BackButton = () => {
  const navigate = useNavigate();
  // history.state.idx > 0 means there is an earlier in-app page to go back to
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/"));
  return (
    <button type="button" onClick={goBack} className={`${btn} group !min-h-[40px] !px-3.5 !py-1.5`}>
      <span className="transition-transform group-hover:-translate-x-1">←</span> Back
    </button>
  );
};

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */
function Footer() {
  const year = new Date().getFullYear();
  const linkItem =
    "group inline-flex min-h-[36px] items-center gap-2 text-sm font-semibold text-[var(--mute)] no-underline transition-colors duration-200 hover:text-[var(--brand)]";
  const social =
    "group inline-flex h-11 items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 text-sm font-bold text-[var(--ink)] no-underline transition duration-300 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--brand)_50%,var(--line))] hover:shadow-[var(--shadow2)] active:scale-[.97]";

  return (
    <footer className="relative mt-4 overflow-hidden border-t border-[var(--line)] bg-[var(--card)]">
      {/* gradient hairline on top */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px]" style={gradBg} />
      {/* soft colour wash */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(50% 80% at 0% 0%,color-mix(in srgb,var(--brand) 10%,transparent),transparent 70%),radial-gradient(45% 70% at 100% 100%,color-mix(in srgb,var(--brand2) 9%,transparent),transparent 70%)",
        }} />

      <div className={`${inner} relative pb-8 pt-10 sm:pt-14`}>
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1.2fr] md:gap-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3">
              <BrandMark size={44} />
              <span className="text-xl font-extrabold tracking-[-.02em]">{SITE_NAME}</span>
            </div>
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
              <li><Link to="/" className={linkItem}><span className="transition-transform duration-200 group-hover:translate-x-1">→</span> Home</Link></li>
              <li><a href="/#jobs" className={linkItem}><span className="transition-transform duration-200 group-hover:translate-x-1">→</span> All job openings</a></li>
              <li><a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={linkItem}><span className="transition-transform duration-200 group-hover:translate-x-1">→</span> Follow on Instagram</a></li>
              {WHATSAPP_URL && (
                <li><a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={linkItem}><span className="transition-transform duration-200 group-hover:translate-x-1">→</span> Join WhatsApp alerts</a></li>
              )}
            </ul>
          </nav>

          {/* Trust note */}
          <div className="self-start rounded-2xl border border-[color-mix(in_srgb,var(--brand)_22%,var(--line))] bg-[var(--soft)] p-4 sm:p-5">
            <div className="flex items-center gap-2.5 text-[var(--ink)]">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[var(--card)] text-[var(--brand)] shadow-[var(--shadow)]"><IShield size={18} /></span>
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
export default function JobDetails() {
  const [jobs, setJobs] = useState(null);
  const [affiliates, setAffiliates] = useState([]);
  const [dark, setDark] = useState(false);
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState("overview");
  const [stepsDone, setStepsDone] = useState([]);
  const [showTop, setShowTop] = useState(false);
  const [params] = useSearchParams();
  const id = params.get("id");
  const heroRef = useRef(null);
  const progressRef = useRef(null);
  const navRef = useRef(null);
  const spotRaf = useRef(0);
  const hoverOk = useRef(false);

  // theme
  useEffect(() => {
    try { const t = localStorage.getItem("js-theme"); if (t) setDark(t === "dark"); } catch { }
    hoverOk.current = canHover();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try { localStorage.setItem("js-theme", dark ? "dark" : "light"); } catch { }
  }, [dark]);

  // reading progress bar + "scrolled past the top" flag (one passive listener, one frame per scroll)
  useEffect(() => {
    let raf = 0;
    let shown = false;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        const p = max > 0 ? h.scrollTop / max : 0;
        if (progressRef.current) progressRef.current.style.transform = `scaleX(${p})`;
        const s = h.scrollTop > 500;
        if (s !== shown) { shown = s; setShowTop(s); }
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // data
  useEffect(() => {
    fetch("/jobs.json?v=" + Date.now(), { cache: "no-store" })
      .then((r) => { if (!r.ok) throw 0; return r.json(); })
      .then((d) => setJobs(Array.isArray(d) ? d : FALLBACK))
      .catch(() => setJobs(FALLBACK));
  }, []);

  // books + videos (managed from admin > Books & videos)
  useEffect(() => {
    fetch("/affiliates.json?v=" + Date.now(), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setAffiliates(Array.isArray(d) ? d : []))
      .catch(() => setAffiliates([]));
  }, []);

  const j = jobs?.find((x) => slug(x) === id);

  // new job opened (e.g. from "Similar jobs"): scroll to top and reset state
  useEffect(() => {
    window.scrollTo(0, 0);
    setCopied(false);
    setActive("overview");
    setStepsDone([]);
  }, [id]);

  // page title + meta description
  useEffect(() => {
    if (!j) return;
    document.title = `${j.role} at ${j.company} – ${SITE_NAME}`;
    const bits = [
      `${j.role} at ${j.company}`,
      j.location && `Location: ${j.location}`,
      j.eligibility && `Eligibility: ${j.eligibility}`,
      j.deadline && `Last date: ${fmt(j.deadline)}`,
    ].filter(Boolean);
    const desc = (bits.join(". ") + ". Dates, eligibility, age limit, fee, selection process, documents and the official link.").slice(0, 300);
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement("meta"); m.setAttribute("name", "description"); document.head.appendChild(m); }
    m.setAttribute("content", desc);

    // pages with little original content are kept out of search until they are filled in
    const p = parts(j);
    const depth = [j.about, p.hasDesc, p.vac.length, p.elig.length, p.age.length, p.dates.length > 1, p.selection.length, p.docs.length, p.howTo.length, j.fee, j.prep, parseFaqs(j.faqs).length].filter(Boolean).length;
    const thin = !j.about || depth < MIN_DEPTH;
    let r = document.querySelector('meta[name="robots"]');
    if (!r && thin) { r = document.createElement("meta"); r.setAttribute("name", "robots"); r.dataset.js = "1"; document.head.appendChild(r); }
    if (r) r.setAttribute("content", thin ? "noindex, follow" : "index, follow");
    return () => { const x = document.querySelector('meta[name="robots"][data-js]'); if (x) x.remove(); };
  }, [j]);

  // JobPosting structured data (only values that exist on the job, nothing invented)
  useEffect(() => {
    if (!j) return;
    const ld = {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: j.role,
      description: plain(j.description || j.about) || `${j.role} recruitment at ${j.company}.`,
      datePosted: j.posted,
      hiringOrganization: { "@type": "Organization", name: j.company },
      jobLocation: {
        "@type": "Place",
        address: { "@type": "PostalAddress", addressLocality: j.location, addressCountry: "IN" },
      },
      employmentType: EMP_TYPE[j.type] || "OTHER",
      directApply: false,
      url: window.location.href,
    };
    if (j.deadline) ld.validThrough = j.deadline;
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.text = JSON.stringify(ld);
    document.head.appendChild(s);
    return () => s.remove();
  }, [j]);

  // similar jobs: same sector first, then same category or location
  const related = useMemo(
    () =>
      j
        ? jobs
          .filter((x) => x !== j && !expired(x) && sectorOf(x) === sectorOf(j) && (x.cat === j.cat || x.location === j.location))
          .slice(0, 6)
        : [],
    [jobs, j]
  );
  const offers = useMemo(() => (j ? pickOffers(j, affiliates) : []), [j, affiliates]);
  const videos = useMemo(
    () => (j ? [...getVideos(j), ...pickVideos(j, affiliates)].filter((v, n, all) => all.findIndex((x) => x.id === v.id) === n) : []),
    [j, affiliates]
  );

  // in-page section bar (same order as the page)
  const sections = useMemo(() => {
    if (!j) return [];
    const p = parts(j);
    return [
      { id: "overview", label: "Overview" },
      j.about && { id: "about", label: "About" },
      p.hasDesc && { id: "description", label: "Job description" },
      p.vac.length > 0 && { id: "vacancy", label: "Vacancies" },
      (j.eligibility || p.elig.length > 0) && { id: "eligibility", label: "Eligibility" },
      (p.age.length > 0 || p.relax.length > 0) && { id: "age", label: "Age limit" },
      j.fee && { id: "fee", label: "Fee" },
      p.selection.length > 0 && { id: "selection", label: "Selection" },
      p.docs.length > 0 && { id: "documents", label: "Documents" },
      p.howTo.length > 0 && { id: "apply", label: "How to apply" },
      p.dates.length > 0 && { id: "dates", label: "Important dates" },
      (p.notification || p.links.length > 0 || (!expired(j) && j.link)) && { id: "links", label: "Important links" },
      (p.notification || (!expired(j) && j.link)) && { id: "official", label: isGovt(j) ? "Official source" : "Apply link" },
      j.prep && { id: "prep", label: "Preparation" },
      offers.length > 0 && { id: "books", label: "Study material" },
      videos.length > 0 && { id: "videos", label: "Videos" },
      p.faqs.length > 0 && { id: "faqs", label: "FAQs" },
      WHATSAPP_URL && { id: "alerts", label: "Job alerts" },
    ].filter(Boolean);
  }, [j, offers, videos]);

  useEffect(() => {
    if (!sections.length) return;
    const els = sections.map((s) => document.getElementById(s.id)).filter(Boolean);
    const io = new IntersectionObserver((es) => {
      const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (v) setActive(v.target.id);
    }, { rootMargin: "-22% 0px -65% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [sections]);

  // keep the active pill centred in the section bar, without ever moving the page itself
  useEffect(() => {
    const bar = navRef.current;
    if (!active || !bar) return;
    const item = bar.querySelector(`[data-section-id="${active}"]`);
    if (!item) return;
    const left = item.offsetLeft - (bar.clientWidth - item.clientWidth) / 2;
    bar.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch { /* address bar still works */ }
  };

  // soft spotlight that follows the mouse across the hero (desktop only, one update per frame)
  const spot = (e) => {
    if (!hoverOk.current || e.pointerType === "touch") return;
    const el = heroRef.current;
    if (!el) return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(spotRaf.current);
    spotRaf.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${clientX - r.left}px`);
      el.style.setProperty("--my", `${clientY - r.top}px`);
    });
  };

  const toggleStep = (i) => setStepsDone((s) => { const n = [...s]; n[i] = !n[i]; return n; });

  let hero = null;
  let bar = null;
  let body;

  if (!jobs) {
    body = (
      <>
        <div className="sk mb-5 h-6 w-56 max-w-full rounded-md" />
        <div className="sk mb-5 h-[200px] rounded-[20px] sm:h-[230px]" />
        <div className="sk h-[240px] rounded-[20px] sm:h-[280px]" />
      </>
    );
  } else if (!j) {
    body = (
      <div className="fu px-2.5 py-[72px] text-center text-[var(--mute)] sm:py-[100px]">
        <div className="bob mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-[var(--soft)] text-3xl">🔍</div>
        <h2 className="mb-2 mt-0 text-2xl tracking-[-.02em] text-[var(--ink)]">Job not found</h2>
        <p className="mb-6 mt-0">It may have been removed or the link is incorrect.</p>
        <Link className={`${btn} ${btnPrimary}`} style={gradBg} to="/">See all openings</Link>
      </div>
    );
  } else {
    const gov = isGovt(j);
    const sectorLabel = gov ? "Government" : "Private";
    const p = parts(j);
    // only the steps typed in admin are shown, so every job page has its own content
    const steps = p.howTo;
    const dl = timeLeft(j);
    const isExp = expired(j);
    const pct = meter(j);
    const doneCount = steps.filter((_, i) => stepsDone[i]).length;
    const share =
      "https://wa.me/?text=" +
      encodeURIComponent(`${j.role} at ${j.company} (${j.location})\n${window.location.href}`);

    const facts = [
      [<IPin key="a" size={18} />, "Location", j.location],
      [<IUser key="b" size={18} />, "Experience", expText(j)],
      [<IBag key="c" size={18} />, "Job type", j.type],
      [<IClock key="d" size={18} />, gov ? "Last date" : "Apply by", j.deadline ? fmt(j.deadline) : "Open"],
    ];

    const overview = [
      [<IBag key="a" size={18} />, "Organization", j.company],
      [<ITag key="b" size={18} />, "Position", j.role],
      [<IPin key="c" size={18} />, "Location", j.location],
      j.salary ? [<IWallet key="d" size={18} />, gov ? "Pay scale" : "Salary", j.salary] : null,
      [<IUser key="e" size={18} />, "Experience", expText(j)],
      [<ICap key="f" size={18} />, "Qualification", j.eligibility || "Not specified"],
      j.vacancies ? [<IUsers key="g" size={18} />, "Vacancies", vacLabel(j.vacancies)] : null,
      [<IClock key="h" size={18} />, "Last date", j.deadline ? fmt(j.deadline) : "Open"],
    ].filter(Boolean);

    // shown in the sidebar on desktop and as a strip under the hero on mobile
    const deadlineBox = (
      <div className={`rounded-2xl px-4 py-3.5 sm:py-4 ${dl.late ? "bg-[var(--warnbg)] text-[var(--warn)]" : "bg-[var(--okbg)] text-[var(--ok)]"}`}>
        <div className="flex items-center gap-2 text-[15px] font-extrabold"><IClock size={18} /> {dl.t}</div>
        {pct !== null && (
          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,currentColor_18%,transparent)]">
              <div className="growx h-full w-full rounded-full bg-current" style={{ transform: `scaleX(${pct / 100})` }} />
            </div>
            <div className="mt-2 flex justify-between gap-3 text-xs font-semibold opacity-90">
              <span>Posted {fmt(j.posted)}</span><span>Closes {fmt(j.deadline)}</span>
            </div>
          </div>
        )}
      </div>
    );

    // vacancy table rows (with a total when the counts are numbers)
    const vacTotal = p.vac.reduce((s, [, n]) => s + (/^\d+$/.test(n) ? +n : 0), 0);
    const vacRows = p.vac.map((c) => ({ cells: c }));
    if (p.vac.length > 1 && vacTotal) vacRows.push({ cells: ["Total", vacTotal], total: true });

    // links table rows
    const normalizeLinkLabel = (label) => String(label || "").trim().toLowerCase().replace(/\s+/g, " ");
    const customLinks = p.links.map(([label, url]) => ({ label: label.trim(), url }));
    const hasCustomLink = (label) =>
      customLinks.some(({ label: customLabel }) => normalizeLinkLabel(customLabel) === normalizeLinkLabel(label));

    const linkRows = [
      // 1. Apply online, always first
      !isExp && j.link && {
        cells: [
          "Apply online",
          <a key="apply" className={linkCls} href={j.link} target="_blank" rel="noopener noreferrer" onClick={() => trackClick(j)}>
            Apply now
          </a>,
        ],
      },
      // 2. Admin-provided links
      ...customLinks.map(({ label, url }) => ({
        cells: [
          label,
          <a key={`${label}-${url}`} className={linkCls} href={url} target="_blank" rel="noopener noreferrer">Open</a>,
        ],
      })),
      // 3. Government fallback links
      gov && !hasCustomLink("Admit card") && { cells: ["Admit card", "Coming soon"] },
      gov && !hasCustomLink("Result") && { cells: ["Result", "Coming soon"] },
    ].filter(Boolean);

    hero = (
      <header key={`h-${id}`} ref={heroRef} onPointerMove={spot}
        className="group/hero relative overflow-hidden border-b border-[var(--line)] bg-[var(--card)]">
        {/* soft colour wash (static, free to render) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(55% 90% at 100% 0%,color-mix(in srgb,var(--brand) 13%,transparent),transparent 70%),radial-gradient(40% 70% at 0% 100%,color-mix(in srgb,var(--brand2) 9%,transparent),transparent 70%)",
          }} />
        {/* drifting glows: radial gradients instead of blur filters, so they animate smoothly. Large screens only. */}
        <div aria-hidden="true" className="blob pointer-events-none absolute -right-24 -top-24 hidden h-80 w-80 rounded-full opacity-[.2] sm:block"
          style={{ backgroundImage: "radial-gradient(circle,var(--brand) 0%,transparent 68%)" }} />
        <div aria-hidden="true" className="blob2 pointer-events-none absolute -bottom-28 left-1/4 hidden h-72 w-72 rounded-full opacity-[.16] lg:block"
          style={{ backgroundImage: "radial-gradient(circle,var(--brand2) 0%,transparent 68%)" }} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden opacity-0 transition-opacity duration-300 group-hover/hero:opacity-100 lg:block"
          style={{ backgroundImage: "radial-gradient(420px circle at var(--mx,50%) var(--my,50%),color-mix(in srgb,var(--brand) 14%,transparent),transparent 60%)" }} />

        <div className={`${inner} relative pb-6 pt-4 sm:pb-8 sm:pt-6`}>
          <div className="fu mb-4 flex flex-wrap items-center gap-3 sm:mb-6">
            <BackButton />
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm text-[var(--mute)] max-sm:hidden">
              <Link to="/" className="no-underline hover:text-[var(--brand)]">Jobs</Link>
              <span aria-hidden="true">/</span>
              <span>{sectorLabel} · {j.cat}</span>
              <span aria-hidden="true">/</span>
              <span className="max-w-[40ch] truncate font-semibold text-[var(--ink)]">{j.role}</span>
            </nav>
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-10">
            {/* LEFT: job info + buttons */}
            <div className="min-w-0 flex-1">
              <div className="fu flex min-w-0 items-start gap-3.5 sm:gap-6" style={{ "--d": ".05s" }}>
                <Mono company={j.company}
                  className="bob h-14 w-14 rounded-2xl text-xl shadow-[var(--shadow2)] ring-4 ring-[var(--card)] sm:h-[88px] sm:w-[88px] sm:rounded-[26px] sm:text-[32px]" />
                <div className="min-w-0">
                  <div className="fu mb-2 flex flex-wrap items-center gap-1.5 sm:gap-2" style={{ "--d": ".12s" }}>
                    <Badge kind={gov ? undefined : "pvt"}>{gov ? "Government job" : "Private job"}</Badge>
                    {/* only claim "actively hiring" when there is a real, future closing date */}
                    {!isExp && j.deadline && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--okbg)] px-3 py-1 text-xs font-bold text-[var(--ok)]">
                        <i aria-hidden="true" className="live h-2 w-2 rounded-full bg-green-500" /> Applications open
                      </span>
                    )}
                    {isNew(j) && <Badge kind="new">New</Badge>}
                    {isExp && <Badge kind="exp">Expired</Badge>}
                    {j.exp === "fresher" && <Badge>Freshers welcome</Badge>}
                  </div>
                  <h1 className="fu m-0 text-balance text-[1.4rem] font-extrabold leading-[1.2] tracking-[-.025em] min-[420px]:text-[1.5rem] sm:text-[clamp(1.65rem,3.8vw,2.5rem)] sm:leading-[1.12]" style={{ "--d": ".18s" }}>{j.role}</h1>
                  <p className="fu mb-0 mt-1.5 text-base font-bold text-[var(--ink)] sm:mt-2 sm:text-[1.1rem]" style={{ "--d": ".22s" }}>{j.company}</p>
                  <p className="fu mb-0 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-[var(--mute)] sm:text-sm" style={{ "--d": ".26s" }}>
                    <IPin size={14} /> <span>{j.location}</span>
                    <span aria-hidden="true">·</span>
                    <span>{ago(j.posted)}</span>
                  </p>
                </div>
              </div>

              {/* mobile: Apply on its own full-width row, Share + Copy side by side below */}
              <div className="fu mt-5 grid grid-cols-2 gap-2.5 sm:mt-6 sm:flex sm:flex-wrap sm:items-center" style={{ "--d": ".2s" }}>
                {!isExp && (
                  <a className={`${btn} ${btnPrimary} col-span-2 !min-h-[52px] !text-[15.5px] sm:min-w-[180px] sm:flex-1 sm:max-w-[260px]`} style={gradBg}
                    href={j.link} target="_blank" rel="noopener noreferrer" onClick={() => trackClick(j)}>
                    Apply now <IArrow />
                  </a>
                )}
                <a className={`${btn} group !min-h-[48px] !px-4 !text-[13px] sm:!min-h-[52px]`} href={share} target="_blank" rel="noopener noreferrer">
                  <span className="inline-flex transition-transform duration-300 group-hover:scale-125"><IShare /></span> Share
                </a>
                <button type="button" onClick={copy}
                  className={`${btn} group !min-h-[48px] !px-4 !text-[13px] sm:!min-h-[52px] ${copied ? "!border-[var(--ok)] !text-[var(--ok)]" : ""}`}>
                  <span className="inline-flex transition-transform duration-300 group-hover:scale-125">
                    {copied ? <ICheck className="tick" /> : <ICopy />}
                  </span> {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            </div>

            {/* RIGHT: big thumbnail (shown first on phones) */}
            <Banner job={j} />
          </div>

          <dl className="fu m-0 mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] shadow-[var(--shadow)] sm:mt-8 lg:grid-cols-4"
            style={{ "--d": ".3s" }}>
            {facts.map(([ic, l, v]) => (
              <div key={l}
                className="group flex min-w-0 flex-col items-start gap-2 bg-[var(--card)] p-3.5 transition-colors hover:bg-[var(--soft)] sm:flex-row sm:items-center sm:gap-3.5 sm:p-5">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[var(--soft)] text-[var(--brand)] transition duration-300 group-hover:scale-110 group-hover:bg-[var(--card)] sm:h-11 sm:w-11">{ic}</span>
                <div className="min-w-0">
                  <dt className="text-xs font-semibold text-[var(--mute)]">{l}</dt>
                  <dd className="m-0 mt-0.5 break-words text-[.92rem] font-extrabold leading-snug sm:text-[.95rem]">{v}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </header>
    );

    // sticks directly under the main nav (64px + any phone notch) so the two bars never overlap
    bar = (
      <div key={`b-${id}`}
        className="glass sticky top-[calc(4rem+env(safe-area-inset-top,0px))] z-30 border-b border-[var(--line)]">
        <div ref={navRef} className={`${inner} noscroll relative flex gap-1 overflow-x-auto overscroll-x-contain py-2`}>
          {sections.map((s) => (
            <a key={s.id} data-section-id={s.id} href={`#${s.id}`}
              aria-current={active === s.id ? "true" : undefined}
              className={`whitespace-nowrap rounded-full px-3.5 py-2.5 text-[13.5px] font-bold no-underline transition-colors duration-300 sm:px-4 sm:text-sm ${active === s.id
                ? "bg-[var(--ink)] text-[var(--card)]"
                : "text-[var(--mute)] hover:bg-[var(--soft)] hover:text-[var(--ink)]"
                }`}>
              {s.label}
            </a>
          ))}
        </div>
      </div>
    );

    body = (
      <div key={`c-${id}`}>
        {isExp && (
          <div className={`${card} pop !bg-[var(--warnbg)] text-[var(--warn)]`}>
            <b>This opening has closed.</b> The last date has passed and the link may no longer work. See similar jobs for other openings.
          </div>
        )}

        {/* deadline strip (mobile only, desktop has it in the sidebar) */}
        {!isExp && <div className="fu mb-4 lg:hidden">{deadlineBox}</div>}

        <div className="grid items-start gap-0 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
          {/* MAIN: sections in reading order */}
          <div className="min-w-0">
            {/* 1. Job overview */}
            <Block id="overview" eyebrow="Overview" title="Job overview">
              <dl className="stg m-0 grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                {overview.map(([ic, l, v], n) => (
                  <div key={l} style={{ "--i": n }}>
                    <Tilt className="group flex h-full items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3.5 hover:border-[color-mix(in_srgb,var(--brand)_40%,var(--line))] hover:shadow-[var(--shadow2)] sm:gap-3.5 sm:p-4">
                      <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[var(--card)] text-[var(--brand)] shadow-[var(--shadow)] transition-transform duration-300 group-hover:scale-110">{ic}</span>
                      <div className="min-w-0">
                        <dt className="text-xs font-semibold text-[var(--mute)]">{l}</dt>
                        <dd className="m-0 mt-0.5 break-words text-[.96rem] font-bold leading-snug sm:text-[.98rem]">{v}</dd>
                      </div>
                    </Tilt>
                  </div>
                ))}
              </dl>
            </Block>

            {/* 2. About this recruitment */}
            {j.about && (
              <Block id="about" eyebrow="Recruitment" title="About this recruitment">
                <Md text={j.about} />
              </Block>
            )}

            {/* 3. Job description: description, responsibilities, skills */}
            {p.hasDesc && (
              <Block id="description" eyebrow="Details" title="Job description">
                <div className="grid gap-7">
                  {j.description && <Md text={j.description} />}
                  {p.resp.length > 0 && (<div><SubHead>Responsibilities</SubHead><Ticks items={p.resp} /></div>)}
                  {p.skills.length > 0 && (
                    <div>
                      <SubHead>Required skills</SubHead>
                      <div className="stg flex flex-wrap gap-2">
                        {p.skills.map((t, n) => (
                          <span key={t} style={{ "--i": n }} className="rounded-full bg-[var(--soft)] px-3.5 py-1.5 text-[13.5px] font-bold text-[var(--brand)] sm:text-sm">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Block>
            )}

            {/* 4. Vacancy details */}
            {p.vac.length > 0 && (
              <Block id="vacancy" eyebrow="Posts" title="Vacancy details">
                <Table head={["Post name", "No. of posts"]} rows={vacRows} />
              </Block>
            )}

            {/* 5. Eligibility */}
            {(j.eligibility || p.elig.length > 0) && (
              <Block id="eligibility" eyebrow="Who can apply" title="Eligibility"
                sub="Check every point below against the official notification before you apply.">
                <div className="grid gap-7">
                  <dl className="m-0 grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                    {[["Educational qualification", j.eligibility], ["Experience", expText(j)]].filter(([, v]) => v).map(([l, v]) => (
                      <div key={l} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
                        <dt className="text-xs font-semibold text-[var(--mute)]">{l}</dt>
                        <dd className="m-0 mt-1 break-words text-[.96rem] font-bold leading-snug sm:text-[.98rem]">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {p.elig.length > 0 && (
                    <div><SubHead>Other requirements</SubHead><Ticks items={p.elig} /></div>
                  )}
                </div>
              </Block>
            )}

            {/* 6. Age limit + relaxation */}
            {(p.age.length > 0 || p.relax.length > 0) && (
              <Block id="age" eyebrow="Age" title="Age limit and relaxation">
                <div className="grid gap-7">
                  {p.age.length > 0 && <div><SubHead>Age limit</SubHead><Ticks items={p.age} /></div>}
                  {p.relax.length > 0 && <div><SubHead>Age relaxation</SubHead><Ticks items={p.relax} /></div>}
                </div>
              </Block>
            )}

            {/* 7. Application fee (table when written as "Category | Fee") */}
            {j.fee && (
              <Block id="fee" eyebrow="Fee" title="Application fee">
                {p.feeRows.length > 0
                  ? <Table head={["Category", "Fee"]} rows={p.feeRows.map((c) => ({ cells: c }))} />
                  : <Md text={j.fee} />}
                {j.feeDate && <p className="mb-0 mt-4 text-sm text-[var(--mute)]">Last date to pay the fee: <b className="text-[var(--ink)]">{fmtAny(j.feeDate)}</b></p>}
              </Block>
            )}

            {/* 8. Selection process */}
            {p.selection.length > 0 && (
              <Block id="selection" eyebrow="Stages" title="Selection process"
                sub={`The selection process for this recruitment has ${p.selection.length} stage${p.selection.length > 1 ? "s" : ""}, in order.`}>
                <ol className="stg relative m-0 grid list-none gap-4 p-0">
                  <span aria-hidden="true" className="absolute bottom-4 left-[17px] top-4 w-[2px] rounded-full bg-[var(--line)]" />
                  {p.selection.map((t, i) => (
                    <li key={`${i}-${t}`} style={{ "--i": i }} className="relative flex items-center gap-3.5">
                      <span style={gradBg} className="z-[1] grid h-9 w-9 flex-none place-items-center rounded-full text-sm font-extrabold text-[var(--bi)] ring-4 ring-[var(--card)]">{i + 1}</span>
                      <span className="min-w-0 text-[.97rem] font-bold sm:text-base">{t}</span>
                    </li>
                  ))}
                </ol>
                <p className="mb-0 mt-5 text-sm text-[var(--mute)]">
                  Candidates should refer to the official notification for the exact selection procedure.
                </p>
              </Block>
            )}

            {/* 9. Documents required */}
            {p.docs.length > 0 && (
              <Block id="documents" eyebrow="Checklist" title="Documents required" sub="Keep these ready before you apply. The official notification may list additional documents.">
                <Ticks items={p.docs} />
              </Block>
            )}

            {/* 10. How to apply (only when steps are written in admin) */}
            {steps.length > 0 && (
              <Reveal as="section" id="apply" className={`${card} scroll-mt-[8.5rem] lg:scroll-mt-[9rem]`}>
                <SectionTitle eyebrow="Process" sub="Tap each step as you finish it.">How to apply</SectionTitle>

                <ol className="relative m-0 grid list-none gap-1.5 p-0 sm:gap-3">
                  {/* progress line: scaled with transform, so it animates without layout work */}
                  <span aria-hidden="true" className="absolute bottom-9 left-[17px] top-9 w-[2px] overflow-hidden rounded-full bg-[var(--line)]">
                    <span className="block h-full w-full origin-top bg-[var(--brand)] transition-transform duration-500 ease-out"
                      style={{ transform: `scaleY(${doneCount > 1 && steps.length > 1 ? (doneCount - 1) / (steps.length - 1) : 0})` }} />
                  </span>
                  {steps.map(([t, d], i) => {
                    const done = !!stepsDone[i];
                    return (
                      <li key={`${i}-${t}`}>
                        <button type="button" onClick={() => toggleStep(i)} aria-pressed={done}
                          className="group relative flex min-h-[48px] w-full cursor-pointer items-start gap-3.5 rounded-2xl border-0 bg-transparent p-2 text-left transition hover:bg-[var(--bg)] active:scale-[.99] sm:gap-4">
                          <span style={done ? gradBg : undefined}
                            className={`z-[1] grid h-9 w-9 flex-none place-items-center rounded-full text-sm font-extrabold ring-4 ring-[var(--card)] transition-all duration-300 group-hover:scale-105 ${done ? "text-[var(--bi)] shadow-[0_8px_18px_-8px_var(--brand)]" : "border-2 border-[var(--line)] bg-[var(--card)] text-[var(--mute)] group-hover:border-[var(--brand)] group-hover:text-[var(--brand)]"}`}>
                            {done ? <ICheck className="tick" /> : i + 1}
                          </span>
                          <span className={`min-w-0 pt-1 transition-opacity duration-300 ${done ? "opacity-60" : ""}`}>
                            <b className="text-[.97rem] sm:text-base">{t}</b>
                            {d && <><br /><span className="text-sm text-[var(--mute)] sm:text-base">{d}</span></>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
                  <div className="min-w-[160px] flex-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
                      <div className="h-full w-full origin-left rounded-full transition-transform duration-500 ease-out"
                        style={{ ...gradBg, transform: `scaleX(${doneCount / steps.length})` }} />
                    </div>
                    <div className="mt-1.5 text-xs font-semibold text-[var(--mute)]">{doneCount} of {steps.length} steps done</div>
                  </div>
                  {doneCount === steps.length && !isExp && (
                    <a className={`${btn} ${btnPrimary} pop max-sm:w-full`} style={gradBg}
                      href={j.link} target="_blank" rel="noopener noreferrer" onClick={() => trackClick(j)}>
                      🎉 You're ready. Apply now <IArrow />
                    </a>
                  )}
                </div>
              </Reveal>
            )}

            {/* 11. Important dates (missing dates show "To be announced" for govt jobs) */}
            {p.dates.length > 0 && (
              <Block id="dates" eyebrow="Timeline" title="Important dates">
                <div className="stg grid gap-2.5 min-[480px]:grid-cols-2 sm:gap-3 lg:grid-cols-3">
                  {p.dates.map((d, n) => (
                    <div key={d.k} style={{ "--i": n }} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--mute)]"><span className="text-[var(--brand)]"><ICal size={16} /></span> {d.label}</div>
                      <div className={`mt-1.5 font-extrabold leading-snug ${d.v === "To be announced" ? "text-[1rem] text-[var(--mute)]" : "text-[1.05rem]"}`}>{fmtAny(d.v)}</div>
                      {d.k === "last" && <div className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${dl.late ? "bg-[var(--warnbg)] text-[var(--warn)]" : "bg-[var(--okbg)] text-[var(--ok)]"}`}>{dl.short}</div>}
                    </div>
                  ))}
                </div>
              </Block>
            )}

            {/* 12. Important links */}
            {linkRows.length > 0 && (
              <Block id="links" eyebrow="Links" title="Important links">
                <Table head={["Link", "Action"]} rows={linkRows} />
              </Block>
            )}

            {/* 13. Official source: notification + apply link + independence note + safety note */}
            {(p.notification || (!isExp && j.link)) && (
              <Block id="official" eyebrow={gov ? "Official" : "Apply"}
                title={gov ? "Official recruitment source" : "Application link and source"}>
                <p className={`mb-4 mt-0 text-[.97rem] sm:text-base ${bodyText}`}>
                  {gov
                    ? `Recruitment information is based on the official notification published by ${j.company}.`
                    : "The application link below is the one provided with this job listing."}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {p.notification && (
                    <div>
                      <div className="mb-1.5 text-xs font-semibold text-[var(--mute)]">Official notification</div>
                      <a className={`${btn} !min-h-[50px] !w-full`} href={p.notification} target="_blank" rel="noopener noreferrer">
                        📄 View notification →
                      </a>
                    </div>
                  )}
                  {!isExp && j.link && (
                    <div>
                      <div className="mb-1.5 text-xs font-semibold text-[var(--mute)]">{gov ? "Official application" : "Application"}</div>
                      <a className={`${btn} ${btnPrimary} !min-h-[50px] !w-full`} style={gradBg}
                        href={j.link} target="_blank" rel="noopener noreferrer" onClick={() => trackClick(j)}>
                        {gov ? "Apply on official website" : "Apply on the employer's page"} <IArrow />
                      </a>
                    </div>
                  )}
                </div>
                <p className="mb-0 mt-3 text-[13px] leading-relaxed text-[var(--mute)] sm:text-sm">
                  {SITE_NAME} is an independent job-information platform and is not affiliated with {j.company}.
                  Candidates should verify all eligibility criteria, dates, fees and other details in the official notification before applying.
                </p>

                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--brand)_22%,var(--line))] bg-[var(--soft)] px-4 py-3.5 text-[13px] leading-relaxed text-[var(--mute)] sm:text-sm">
                  <span className="mt-0.5 text-[var(--brand)]"><IShield size={18} /></span>
                  <span>
                    <b className="text-[var(--ink)]">Stay safe.</b>{" "}
                    {gov
                      ? "Apply only on the official recruitment website and never pay an agent or middleman for a government job. The fee, if any, is paid only on the official portal."
                      : "Never pay money to get a job. A real employer will not ask you for a fee."}
                  </span>
                </div>
              </Block>
            )}

            {/* 14. Preparation guide */}
            {j.prep && (
              <Block id="prep" eyebrow="Prepare" title="Preparation guide">
                <Md text={j.prep} />
              </Block>
            )}

            {/* 15. Study material and videos */}
            {offers.length > 0 && (
              <Rail id="books" eyebrow="Prepare" title="Recommended study material"
                sub={`Why these are included: they cover subjects and the exam pattern relevant to this recruitment. Compare any material with the official syllabus before buying or using it. Some links are affiliate links, which support ${SITE_NAME} at no extra cost to you.`}>
                {offers.map((o, n) => (
                  <Reveal key={o.id || o.title} d={Math.min(n, 5) * 0.06} className="flex-none snap-start">
                    <OfferCard o={o} />
                  </Reveal>
                ))}
              </Rail>
            )}
            {videos.length > 0 && <VideoSection videos={videos} />}

            {/* 16. FAQs */}
            {p.faqs.length > 0 && (
              <Block id="faqs" eyebrow="Questions" title="Frequently asked questions">
                <div className="grid gap-2.5">
                  {p.faqs.map((f, i) => (
                    <details key={i} className="group rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 transition-colors open:bg-[var(--card)] open:shadow-[var(--shadow)] sm:py-3.5">
                      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 font-bold [&::-webkit-details-marker]:hidden">
                        <span className="min-w-0 text-[.95rem] sm:text-base">{f.q}</span>
                        <span aria-hidden="true" className="text-xl leading-none text-[var(--brand)] transition-transform duration-300 group-open:rotate-45">+</span>
                      </summary>
                      <div className="faq-body pb-1 pt-1 text-[var(--mute)]"><Md text={f.a} /></div>
                    </details>
                  ))}
                </div>
              </Block>
            )}

            {/* 17. Job alerts (WhatsApp only, shown once WHATSAPP_URL is set in site.js) */}
            {WHATSAPP_URL && (
              <Reveal as="section" id="alerts"
                className="relative mb-4 scroll-mt-[8.5rem] overflow-hidden rounded-2xl border border-[color-mix(in_srgb,#25D366_30%,var(--line))] bg-[var(--card)] shadow-[var(--shadow)] sm:mb-5 sm:rounded-[24px] lg:scroll-mt-[9rem]">
                {/* soft green glow */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0"
                  style={{ backgroundImage: "radial-gradient(55% 90% at 100% 0%,color-mix(in srgb,#25D366 16%,transparent),transparent 70%),radial-gradient(40% 70% at 0% 100%,color-mix(in srgb,var(--brand) 8%,transparent),transparent 70%)" }} />

                <div className="relative flex flex-col items-center gap-4 px-5 py-7 text-center sm:gap-5 sm:px-10 sm:py-10">
                  <span className="bob relative grid h-16 w-16 place-items-center rounded-[22px] bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white shadow-[0_14px_30px_-10px_#25D366]">
                    <IWhatsApp size={32} />
                    <span aria-hidden="true" className="live absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-[var(--card)] bg-red-500" />
                  </span>

                  <div>
                    <h2 className="m-0 text-[1.3rem] font-extrabold tracking-[-.02em] sm:text-[1.7rem]">
                      Get job alerts on WhatsApp
                    </h2>
                    <p className="mx-auto mb-0 mt-2 max-w-[48ch] text-[.93rem] leading-relaxed text-[var(--mute)] sm:text-base">
                      New government and private job notifications, sent straight to your phone the moment they are posted.
                    </p>
                  </div>

                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                    className="shine group relative inline-flex min-h-[56px] w-full max-w-[360px] items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#25D366] to-[#128C7E] px-6 text-[15px] font-extrabold text-white no-underline shadow-[0_16px_32px_-14px_#128C7E] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_40px_-14px_#128C7E] active:scale-[.98] sm:px-8 sm:text-base">
                    <IWhatsApp size={22} />
                    Join WhatsApp Channel
                    <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </a>

                  <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-x-4 gap-y-2 p-0 text-[12.5px] font-semibold text-[var(--mute)] sm:gap-x-5 sm:text-[13px]">
                    {["100% free", "No spam", "Leave anytime", "Daily updates"].map((t) => (
                      <li key={t} className="inline-flex items-center gap-1.5">
                        <span className="text-[#1FA855]"><ICheck /></span> {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            )}
          </div>

          {/* SIDEBAR */}
          <aside className="lg:sticky lg:top-[9.25rem]">
            {!isExp && (
              <Reveal d={0.1} className={`${card} !p-5 max-lg:hidden`}>
                {deadlineBox}
                <a className={`${btn} ${btnPrimary} mt-4 !min-h-[50px] !w-full !text-[15px]`} style={gradBg}
                  href={j.link} target="_blank" rel="noopener noreferrer" onClick={() => trackClick(j)}>
                  Apply now <IArrow />
                </a>
              </Reveal>
            )}

            {related.length > 0 && (
              <Reveal as="section" d={0.14} className={`${card} !p-0 overflow-hidden`}>
                <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-4 sm:px-5">
                  <h2 className="m-0 text-base font-extrabold tracking-[-.01em]">Similar {gov ? "government" : "private"} jobs</h2>
                  <a href="/#jobs" className="text-sm font-bold text-[var(--brand)] no-underline hover:underline">View all</a>
                </div>
                <ul className="m-0 list-none p-0">
                  {related.map((r) => (
                    <li key={slug(r)} className="border-b border-[var(--line)] last:border-b-0">
                      <Link to={`/job?id=${slug(r)}`} className="group flex min-h-[64px] items-start gap-3 px-4 py-3.5 no-underline transition-colors duration-200 hover:bg-[var(--bg)] active:bg-[var(--bg)] sm:px-5 sm:py-4">
                        <Thumb job={r} className="h-11 w-11 rounded-xl text-[15px] transition-transform duration-300 group-hover:scale-105" />
                        <span className="min-w-0 flex-1">
                          <b className="block truncate text-[.95rem] text-[var(--ink)] group-hover:text-[var(--brand)]">{r.role}</b>
                          <small className="block truncate text-sm text-[var(--mute)]">{r.company}</small>
                          <small className="mt-1 flex items-center gap-1 text-xs text-[var(--mute)]"><IPin size={13} /> <span className="truncate">{r.location} · {ago(r.posted).replace("Posted ", "")}</span></small>
                        </span>
                        <span aria-hidden="true" className="self-center text-[var(--brand)] opacity-0 transition duration-300 group-hover:translate-x-1 group-hover:opacity-100 max-lg:opacity-60">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}

            <Reveal d={0.18} className="mb-4 flex items-center gap-3.5 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 text-sm text-[var(--mute)] shadow-[var(--shadow)] sm:mb-5 sm:rounded-[20px]">
              <BrandMark size={44} className="bob" />
              <p className="m-0 min-w-0">Found on <b className="text-[var(--ink)]">@{INSTAGRAM_HANDLE}</b>. Follow us on Instagram for new openings every day.</p>
            </Reveal>
          </aside>
        </div>

        {/* MOBILE APPLY BAR: slides up once you scroll past the top, so it never repeats the hero button */}
        {!isExp && (
          <div aria-hidden={!showTop}
            className={`glass fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-2.5 shadow-[0_-8px_24px_-16px_rgba(11,18,32,.25)] transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] lg:hidden ${showTop ? "translate-y-0" : "pointer-events-none translate-y-full"}`}>
            <div className="mx-auto flex max-w-[560px] items-center gap-3">
              <div className="min-w-0 flex-1">
                <b className="block truncate text-sm">{j.role}</b>
                <small className={`text-xs ${dl.late ? "font-semibold text-[var(--warn)]" : "text-[var(--mute)]"}`}>{dl.short}</small>
              </div>
              <a className={`${btn} ${btnPrimary} !min-h-[46px] !px-5`} style={gradBg} tabIndex={showTop ? 0 : -1}
                href={j.link} target="_blank" rel="noopener noreferrer" onClick={() => trackClick(j)}>
                Apply now <IArrow />
              </a>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] pb-24 text-base leading-relaxed text-[var(--ink)] lg:pb-0">
      <style>{CSS}</style>

      {/* reading progress */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]">
        <div ref={progressRef} style={{ ...gradBg, transform: "scaleX(0)" }} className="h-full origin-left will-change-transform" />
      </div>

      <Nav dark={dark} setDark={setDark} />
      {hero}
      {bar}
      <main className={`${inner} pb-10 pt-4 sm:pb-12 sm:pt-6`}>{body}</main>
      <Footer />

      {/* copied toast */}
      {copied && (
        <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-[65] flex justify-center px-4 lg:bottom-8">
          <div className="pop inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-bold text-[var(--card)] shadow-2xl">
            <ICheck className="tick" /> Link copied
          </div>
        </div>
      )}

      {/* back to top (desktop only, mobile has the apply bar) */}
      <button type="button" aria-label="Back to top" tabIndex={showTop ? 0 : -1}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`${arrowBtn} fixed bottom-6 right-6 z-[55] shadow-[var(--shadow2)] transition duration-300 max-lg:hidden ${showTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}>
        <IUp />
      </button>
    </div>
  );
}