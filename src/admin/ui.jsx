/* Shared admin look: tokens, Tailwind class strings, icons */
import { BrandMark } from "../Brand";

export const ADMIN_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap");
.admin{--side:#0e1226;--side-ink:#b4b9d6;--side-hi:rgba(255,255,255,.08);
--bg:#f6f7fb;--card:#fff;--ink:#0b1220;--mute:#5b677f;--faint:#8b95ab;--line:#e5e8f0;--line2:#d3d8e6;
--brand:#4f46e5;--brand2:#2563eb;--bi:#fff;--brand-d:#4338ca;--brand-t:#f0f2ff;--soft:#f0f2ff;
--grad:linear-gradient(135deg,var(--brand),var(--brand2));
--amber:#b45309;--amber-t:#fef3c7;--red:#b91c1c;--red-t:#fee2e2;--green:#047857;--green-t:#dcfce7;--grey-t:#eef0f7;
--sh:0 1px 2px rgba(11,18,32,.04),0 8px 24px -14px rgba(11,18,32,.12);
--sh2:0 2px 6px rgba(11,18,32,.06),0 22px 44px -18px rgba(79,70,229,.32);
font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.admin :focus-visible{outline:2px solid var(--brand);outline-offset:2px;border-radius:8px}
.admin svg{display:block}
.admin ::selection{background:var(--brand);color:#fff}
html{scroll-behavior:smooth}
@keyframes admin-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
@keyframes admin-spin{to{transform:rotate(360deg)}}
.toast-in{animation:admin-in .2s ease}
.admin-spin{animation:admin-spin .8s linear infinite}
@media (prefers-reduced-motion:reduce){.toast-in,.admin-spin{animation:none}}
`;

export const btn =
  "inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--line2)] bg-[var(--card)] px-4 py-[9px] text-[13.5px] font-semibold text-[var(--ink)] no-underline transition hover:border-[var(--ink)] active:scale-[.98]";
export const btnP =
  "!border-transparent !text-white shadow-[0_8px_20px_-8px_var(--brand)] [background-image:var(--grad)] hover:brightness-110";
export const btnD = "!border-[var(--red)] !bg-[var(--red)] !text-white hover:!bg-[#991b1b]";
export const btnI = "!min-h-0 !rounded-lg !p-[7px]";

export const field =
  "w-full rounded-lg border border-[var(--line2)] bg-[var(--card)] px-3 py-2.5 text-[15px] text-[var(--ink)] transition hover:border-[#b8c0d6] focus:border-[var(--brand)] focus:shadow-[0_0_0_4px_var(--brand-t)] focus:outline-none";
export const labelCls = "flex flex-col gap-1.5 text-[13px] font-semibold text-[var(--ink)]";
export const panel =
  "mb-[18px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-[var(--sh)]";

const chipBase = "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-[3px] text-[11.5px] font-semibold ";
export const chip = {
  grey: chipBase + "bg-[var(--grey-t)] text-[var(--mute)]",
  ok: chipBase + "bg-[var(--green-t)] text-[var(--green)]",
  warn: chipBase + "bg-[var(--amber-t)] text-[var(--amber)]",
  no: chipBase + "bg-[var(--red-t)] text-[var(--red)]",
  brand: chipBase + "bg-[var(--soft)] text-[var(--brand)]",
};

const I = ({ size = 18, sw = 2, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">{children}</svg>
);
export const IconBriefcase = (p) => <I {...p} sw={2.2}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></I>;
export const IconPlus = (p) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></I>;
export const IconPlusSm = (p) => <I {...p} sw={2.4}><path d="M12 5v14M5 12h14" /></I>;
export const IconDash = (p) => <I {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></I>;
export const IconList = (p) => <I {...p}><path d="M4 6h16M4 12h16M4 18h10" /></I>;
export const IconTag = (p) => <I {...p}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></I>;
export const IconLogout = (p) => <I {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></I>;
export const IconSearch = (p) => <I {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></I>;
export const IconRefresh = (p) => <I {...p}><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /></I>;
export const IconEdit = (p) => <I {...p}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></I>;
export const IconTrash = (p) => <I {...p}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></I>;

// same brand mark as the public site
export const Mark = () => <BrandMark size={34} />;