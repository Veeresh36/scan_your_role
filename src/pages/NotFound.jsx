import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

/* Theme tokens + keyframes (same tokens as other pages; move to index.css if you prefer) */
const CSS = `
:root{--bg:#f7f8fb;--card:#fff;--ink:#0f172a;--mute:#5b6475;--line:#e6e8ef;--brand:#4f46e5;--bi:#fff;--soft:#eef0ff;
--shadow:0 1px 2px rgba(15,23,42,.04),0 8px 24px -12px rgba(15,23,42,.12)}
:root[data-theme="dark"]{--bg:#0a0c14;--card:#12151f;--ink:#eef0f6;--mute:#98a0b3;--line:#232838;--brand:#8b8cff;--bi:#0a0c14;--soft:#1b1f3d;
--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px -12px rgba(0,0,0,.6)}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;transition:background .3s,color .3s}
:focus-visible{outline:3px solid var(--brand);outline-offset:2px}
h1:focus{outline:none}

@keyframes rise{to{opacity:1;transform:none}}
@keyframes drift{from{transform:translate(0,0) scale(1)}to{transform:translate(40px,30px) scale(1.12)}}
@keyframes hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-.14em)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes ping{0%{transform:scale(.7);opacity:.55}100%{transform:scale(1.35);opacity:0}}
@keyframes scan{
  0%{transform:translate(-34%,-24%) rotate(-8deg)}
  20%{transform:translate(30%,-30%) rotate(6deg)}
  45%{transform:translate(36%,22%) rotate(-4deg)}
  70%{transform:translate(-26%,30%) rotate(8deg)}
  100%{transform:translate(-34%,-24%) rotate(-8deg)}
}
@keyframes wobble{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
@keyframes floatUp{
  0%{transform:translateY(40px) rotate(var(--r,0deg));opacity:0}
  15%{opacity:var(--o,.7)}
  85%{opacity:var(--o,.7)}
  100%{transform:translateY(-110vh) rotate(var(--r,0deg));opacity:0}
}
@keyframes blink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}

.rise{opacity:0;transform:translateY(16px);animation:rise .7s cubic-bezier(.2,.7,.2,1) forwards;animation-delay:var(--d,0s)}
.blob{animation:drift 14s ease-in-out infinite alternate}
.digit{display:inline-block;animation:hop 2.4s ease-in-out infinite;animation-delay:var(--d,0s)}
.ring{animation:spin 14s linear infinite;transform-origin:50% 50%}
.pulse{animation:ping 2.4s ease-out infinite}
.lens{animation:scan 7s ease-in-out infinite}
.wob{animation:wobble 4s ease-in-out infinite}
.fall{animation:floatUp var(--t,16s) linear infinite;animation-delay:var(--d,0s);opacity:0}
.eye{animation:blink 5s infinite;transform-origin:50% 50%}

/* user-controlled pause (WCAG 2.2.2): freezes the looping decoration only */
.paused .blob,.paused .digit,.paused .ring,.paused .pulse,.paused .lens,.paused .wob,.paused .fall,.paused .eye{animation-play-state:paused}

@media (prefers-reduced-motion:reduce){
  *{animation:none!important;transition:none!important}
  .rise{opacity:1!important;transform:none!important}
  .fall{display:none}
}
`;

const btn =
    "inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--card)] px-5 py-[11px] text-sm font-bold no-underline transition hover:-translate-y-px hover:border-[var(--brand)] active:translate-y-0 active:scale-[.98]";
const btnPrimary =
    "!border-[var(--brand)] !bg-[var(--brand)] !text-[var(--bi)] hover:shadow-[0_10px_24px_-10px_var(--brand)]";
const chip =
    "inline-flex min-h-[40px] items-center rounded-full border border-[var(--line)] bg-[var(--card)] px-4 text-sm font-bold no-underline transition hover:border-[var(--brand)] hover:text-[var(--brand)]";
const inner = "mx-auto max-w-[1280px] px-[clamp(18px,4vw,48px)]";
const rise = (d) => ({ "--d": `${d}s` });

/* Little skeleton job cards that drift up the page behind the 404 */
const FALLING = [
    { left: "6%", t: 17, d: 0, r: -6, w: 190 },
    { left: "20%", t: 21, d: -7, r: 4, w: 160 },
    { left: "38%", t: 19, d: -12, r: -3, w: 180 },
    { left: "62%", t: 23, d: -4, r: 5, w: 170 },
    { left: "78%", t: 18, d: -10, r: -5, w: 190 },
    { left: "90%", t: 22, d: -15, r: 3, w: 150 },
];

const MiniCard = ({ w }) => (
    <div style={{ width: w }} className="flex items-center gap-2.5 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-3 shadow-[var(--shadow)]">
        <div className="h-9 w-9 flex-none rounded-[10px] bg-[var(--soft)]" />
        <div className="grid flex-1 gap-1.5">
            <div className="h-2.5 w-4/5 rounded bg-[var(--line)]" />
            <div className="h-2 w-1/2 rounded bg-[var(--soft)]" />
        </div>
    </div>
);

export default function NotFound() {
    const [dark, setDark] = useState(false);
    const [paused, setPaused] = useState(false);
    const [q, setQ] = useState("");
    const [err, setErr] = useState("");
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const headingRef = useRef(null);
    const inputRef = useRef(null);

    // theme
    useEffect(() => {
        try { const t = localStorage.getItem("js-theme"); if (t) setDark(t === "dark"); } catch { }
    }, []);
    useEffect(() => {
        document.documentElement.dataset.theme = dark ? "dark" : "light";
        try { localStorage.setItem("js-theme", dark ? "dark" : "light"); } catch { }
    }, [dark]);

    // title, keep search engines from indexing error pages, move focus to the heading for screen readers
    useEffect(() => {
        document.title = "Page not found – Job Scanner";
        const meta = document.createElement("meta");
        meta.name = "robots";
        meta.content = "noindex";
        document.head.appendChild(meta);
        headingRef.current?.focus({ preventScroll: true });
        return () => meta.remove();
    }, []);

    const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/"));

    const onSearch = (e) => {
        e.preventDefault();
        const term = q.trim();
        if (!term) {
            setErr("Type a role, company or city to search.");
            inputRef.current?.focus();
            return;
        }
        navigate(`/?q=${encodeURIComponent(term)}`);
    };

    return (
        <div className={`flex min-h-screen flex-col bg-[var(--bg)] pb-[env(safe-area-inset-bottom,0px)] text-base leading-relaxed text-[var(--ink)] ${paused ? "paused" : ""}`}>
            <style>{CSS}</style>

            {/* skip link for keyboard users */}
            <a href="#content"
                className="sr-only z-50 rounded-lg bg-[var(--brand)] px-4 py-2 font-bold text-[var(--bi)] focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
                Skip to content
            </a>

            {/* NAV */}
            <nav aria-label="Main"
                className="sticky top-0 z-30 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] pt-[env(safe-area-inset-top,0px)] backdrop-blur-[14px]">
                <div className={`${inner} flex h-[68px] items-center justify-between gap-3`}>
                    <Link to="/" className="group flex items-center gap-2.5 text-[19px] font-extrabold tracking-[-.01em] no-underline">
                        <i className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--brand)] not-italic text-[var(--bi)] transition-transform duration-[400ms] group-hover:rotate-90">✦</i>
                        <span className="max-sm:hidden">Job Scanner</span>
                    </Link>
                    <ul className="m-0 flex list-none items-center gap-0.5 p-0">
                        <li className="max-sm:hidden">
                            <Link to="/" className="inline-flex min-h-[44px] items-center rounded-[10px] px-3.5 text-sm font-semibold text-[var(--mute)] no-underline transition hover:bg-[var(--soft)] hover:text-[var(--brand)]">
                                Home
                            </Link>
                        </li>
                        <li className="ml-0.5">
                            <button type="button" onClick={() => setDark((d) => !d)} aria-label="Switch light or dark mode" className={`${btn} !px-4 !py-[9px]`}>
                                {dark ? "☀️ Light" : "🌙 Dark"}
                            </button>
                        </li>
                        <li className="ml-0.5">
                            <a className={`${btn} ${btnPrimary} !px-4 !py-[9px]`} href="https://www.instagram.com/getjobscanner/" target="_blank" rel="noopener noreferrer">
                                Follow on Instagram
                            </a>
                        </li>
                    </ul>
                </div>
            </nav>

            {/* CONTENT */}
            <main id="content" className="relative flex flex-1 items-center justify-center overflow-hidden">
                {/* background blobs */}
                <div aria-hidden="true" className="blob pointer-events-none absolute -right-20 -top-[120px] h-[420px] w-[420px] rounded-full bg-[var(--brand)] opacity-[.13] blur-[90px]" />
                <div aria-hidden="true" className="blob pointer-events-none absolute -bottom-[140px] -left-[60px] h-[320px] w-[320px] rounded-full bg-[var(--brand)] opacity-[.09] blur-[90px]" style={{ animationDelay: "-6s" }} />

                {/* drifting job cards */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                    {FALLING.map((c, i) => (
                        <div key={i} className="fall absolute top-full max-sm:hidden"
                            style={{ left: c.left, "--t": `${c.t}s`, "--d": `${c.d}s`, "--r": `${c.r}deg`, "--o": 0.7 }}>
                            <MiniCard w={c.w} />
                        </div>
                    ))}
                </div>

                <div className={`${inner} relative py-[clamp(40px,8vw,96px)] text-center`}>
                    {/* animated 404: the zero is a scanner with a magnifier searching inside it */}
                    <div role="img" aria-label="Error 404"
                        className="mx-auto flex items-center justify-center text-[clamp(5rem,18vw,11rem)] font-extrabold leading-none tracking-[-.05em] text-[var(--brand)]">
                        <span className="digit" style={{ "--d": "0s" }}>4</span>

                        <span className="digit relative mx-[.04em] inline-grid h-[1em] w-[.9em] place-items-center" style={{ "--d": ".2s" }}>
                            <span className="pulse absolute inset-[8%] rounded-full border-[.06em] border-[var(--brand)]" />
                            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
                                <circle className="ring" cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 7" opacity=".5" />
                                <circle cx="50" cy="50" r="33" fill="none" stroke="currentColor" strokeWidth="13" opacity=".95" />
                            </svg>
                            <svg viewBox="0 0 64 64" className="lens relative h-[.5em] w-[.5em] text-[var(--ink)]" aria-hidden="true">
                                <circle cx="26" cy="26" r="16" fill="var(--bg)" fillOpacity=".75" stroke="currentColor" strokeWidth="5" />
                                <path d="M38 38l18 18" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
                                <g className="eye">
                                    <circle cx="21" cy="24" r="2.2" fill="currentColor" />
                                    <circle cx="31" cy="24" r="2.2" fill="currentColor" />
                                </g>
                                <path d="M21 31q5 4 10 0" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                            </svg>
                        </span>

                        <span className="digit" style={{ "--d": ".4s" }}>4</span>
                    </div>

                    <h1 ref={headingRef} tabIndex={-1}
                        className="rise wob mb-2 mt-6 text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold leading-[1.1] tracking-[-.03em]" style={rise(0.2)}>
                        We looked everywhere
                    </h1>
                    <p className="rise mx-auto mb-1 mt-0 max-w-[44ch] text-[1.05rem] text-[var(--mute)]" style={rise(0.3)}>
                        This page isn't here. The link may be broken, or the job may have closed.
                    </p>
                    <p className="rise mx-auto mb-7 mt-0 max-w-full truncate text-sm text-[var(--mute)]" style={rise(0.34)}>
                        Not found: <code className="rounded-md bg-[var(--soft)] px-2 py-0.5">{pathname}</code>
                    </p>

                    {/* recovery: search straight from the error page */}
                    <form onSubmit={onSearch} role="search" noValidate className="rise mx-auto max-w-[520px]" style={rise(0.4)}>
                        <label htmlFor="nf-search" className="sr-only">Search jobs</label>
                        <div className={`flex items-center gap-2 rounded-2xl border bg-[var(--card)] py-[6px] pl-[16px] pr-[6px] shadow-[var(--shadow)] transition focus-within:border-[var(--brand)] focus-within:shadow-[0_0_0_4px_var(--soft),var(--shadow)] ${err ? "border-[var(--brand)]" : "border-[var(--line)]"}`}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className="flex-none text-[var(--mute)]">
                                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
                            </svg>
                            <input id="nf-search" ref={inputRef} type="search" value={q} autoComplete="off"
                                onChange={(e) => { setQ(e.target.value); if (err) setErr(""); }}
                                placeholder="Search company, role or city"
                                aria-invalid={!!err} aria-describedby={err ? "nf-err" : undefined}
                                className="min-h-[44px] min-w-0 flex-1 border-0 bg-transparent px-1 text-base outline-none" />
                            <button type="submit" className={`${btn} ${btnPrimary}`}>Search</button>
                        </div>
                        <p id="nf-err" role="alert" className="mb-0 mt-2 min-h-[1.25rem] text-left text-sm font-semibold text-[var(--brand)]">{err}</p>
                    </form>

                    {/* quick shortcuts */}
                    <div className="rise mt-3 flex flex-wrap items-center justify-center gap-2" style={rise(0.48)}>
                        <span className="text-sm text-[var(--mute)]">Popular:</span>
                        <Link to="/?exp=fresher" className={chip}>Freshers</Link>
                        <Link to="/?cat=Tech" className={chip}>Tech</Link>
                        <Link to="/?cat=Non-Tech" className={chip}>Non-Tech</Link>
                    </div>

                    <div className="rise mt-8 flex flex-wrap items-center justify-center gap-3" style={rise(0.56)}>
                        <Link to="/" className={`${btn} ${btnPrimary} !px-6`}>See all openings</Link>
                        <button type="button" onClick={goBack} className={`${btn} group !px-6`}>
                            <span className="transition-transform group-hover:-translate-x-1">←</span> Go back
                        </button>
                    </div>
                </div>

                {/* let people stop the looping motion */}
                <button type="button" onClick={() => setPaused((p) => !p)} aria-pressed={paused}
                    className="absolute bottom-3 right-3 min-h-[40px] rounded-full border border-[var(--line)] bg-[var(--card)] px-4 text-[13px] font-semibold text-[var(--mute)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]">
                    {paused ? "▶ Play animations" : "⏸ Pause animations"}
                </button>
            </main>

            {/* FOOTER */}
            <footer className="border-t border-[var(--line)] pb-11 pt-7 text-sm text-[var(--mute)]">
                <div className={`${inner} flex flex-wrap justify-between gap-3`}>
                    <span>Job Scanner · @getjobscanner</span>
                    <span>Always apply through the official link and never pay money for a job.</span>
                </div>
            </footer>
        </div>
    );
}