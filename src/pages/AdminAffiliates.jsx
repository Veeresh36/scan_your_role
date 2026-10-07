import { useEffect, useRef, useState } from "react";
import { useAdmin } from "../admin/AdminContext";
import { btn, btnP, btnI, chip, field, labelCls, panel, IconEdit, IconPlusSm, IconTrash } from "../admin/ui";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const findToken = () => {
    for (const s of [sessionStorage, localStorage]) {
        try {
            for (let i = 0; i < s.length; i++) {
                const v = s.getItem(s.key(i)) || "";
                if (UUID.test(v)) return v;
                try { const t = JSON.parse(v)?.token; if (UUID.test(t || "")) return t; } catch { }
            }
        } catch { }
    }
    return "";
};

async function api(path, body, token) {
    const r = await fetch("/api" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Request failed");
    return d;
}

const ytId = (u) => {
    const m = String(u || "").match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : "";
};

// kind: "offer" (book / course / product) or "video" (YouTube). jobIds = the jobs it is shown on.
const EMPTY = { kind: "offer", title: "", desc: "", link: "", image: "", cta: "View offer", active: true, jobIds: [] };
const newId = () => Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-6);
// Older entries without a kind count as books / offers.
const kindOf = (x) => (x.kind === "video" ? "video" : "offer");

export default function AdminAffiliates() {
    const admin = useAdmin();
    const toast = admin.toast || (() => { });
    const token = admin.token || findToken();
    const jobs = admin.jobs || [];

    const [list, setList] = useState([]);
    const [v, setV] = useState(EMPTY);
    const [editId, setEditId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [q, setQ] = useState("");
    const [tab, setTab] = useState("offer"); // "offer" | "video"
    const fileRef = useRef(null);
    const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
    const isVideo = v.kind === "video";

    const offers = list.filter((x) => kindOf(x) === "offer");
    const videos = list.filter((x) => kindOf(x) === "video");
    const visible = tab === "video" ? videos : offers;

    useEffect(() => {
        fetch("/affiliates.json?v=" + Date.now(), { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : []))
            .then((d) => setList(Array.isArray(d) ? d : []))
            .catch(() => setList([]));
    }, []);

    const persist = async (next, msg) => {
        try {
            await api("/affiliates", next, token);
            setList(next);
            toast(msg);
            return true;
        } catch (e) {
            toast(e.message === "Not signed in" ? "Session expired. Log out and sign in again." : e.message);
            return false;
        }
    };

    const submit = async (e) => {
        e.preventDefault();
        if (isVideo && !ytId(v.link)) { toast("Paste a valid YouTube link."); return; }
        setSaving(true);
        const item = { ...v, id: editId || newId() };
        const next = editId ? list.map((x) => (x.id === editId ? item : x)) : [...list, item];
        const ok = await persist(next, editId ? "Saved." : isVideo ? "Video added." : "Offer added.");
        if (ok) { setTab(kindOf(item)); setV(EMPTY); setEditId(null); }
        setSaving(false);
    };

    const upload = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = async () => {
            setUploading(true);
            try {
                const d = await api("/upload", { name: f.name, data: rd.result }, token);
                setV((s) => ({ ...s, image: d.url }));
                toast("Image uploaded.");
            } catch (err) {
                toast(err.message);
            }
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        };
        rd.readAsDataURL(f);
    };

    const toggleJob = (id) =>
        setV((s) => ({ ...s, jobIds: s.jobIds.includes(id) ? s.jobIds.filter((x) => x !== id) : [...s.jobIds, id] }));

    const shownJobs = jobs.filter((j) => {
        const t = q.trim().toLowerCase();
        return !t || `${j.company} ${j.role}`.toLowerCase().includes(t);
    });

    const edit = (x) => {
        setV({ ...EMPTY, ...x, jobIds: x.jobIds || [] });
        setEditId(x.id);
        setTab(kindOf(x));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const remove = (x) => { if (window.confirm(`Delete "${x.title}"?`)) persist(list.filter((i) => i.id !== x.id), "Deleted."); };
    const toggle = (x) => persist(list.map((i) => (i.id === x.id ? { ...i, active: i.active === false } : i)), x.active === false ? "Shown on site." : "Hidden from site.");
    const jobName = (id) => { const j = jobs.find((x) => x.id === id); return j ? `${j.company} – ${j.role}` : ""; };

    return (
        <>
            <div className="mb-6">
                <h1 className="m-0 text-[28px] leading-tight tracking-[-.025em]">Books &amp; videos</h1>
                <p className="mb-0 mt-1 text-[var(--mute)]">Each book or video shows only on the jobs you tick below. Nothing is shown by category.</p>
            </div>

            <form onSubmit={submit} className={`${panel} p-6`}>
                <h2 className="m-0 text-base">{editId ? "Edit" : "Add"} {isVideo ? "video" : "book / offer"}</h2>

                <div className="mb-[18px] mt-3 flex gap-2">
                    <button type="button" className={`${btn} ${!isVideo ? btnP : ""}`} onClick={() => setV((s) => ({ ...s, kind: "offer" }))}>Book / offer</button>
                    <button type="button" className={`${btn} ${isVideo ? btnP : ""}`} onClick={() => setV((s) => ({ ...s, kind: "video" }))}>YouTube video</button>
                </div>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-x-5 gap-y-4">
                    <label className={`${labelCls} ${isVideo ? "col-span-full" : ""}`}>Title
                        <input className={field} value={v.title} onChange={set("title")} required
                            placeholder={isVideo ? "Software testing interview questions" : "Learn web development"} />
                    </label>
                    {!isVideo && (
                        <label className={labelCls}>Button text<input className={field} value={v.cta} onChange={set("cta")} placeholder="View offer" /></label>
                    )}
                    {!isVideo && (
                        <label className={`${labelCls} col-span-full`}>Short description
                            <input className={field} value={v.desc} onChange={set("desc")} placeholder="One line about the offer" />
                        </label>
                    )}
                    <label className={`${labelCls} col-span-full`}>{isVideo ? "YouTube link" : "Affiliate link"}
                        <input className={field} type="url" value={v.link} onChange={set("link")} required
                            placeholder={isVideo ? "https://www.youtube.com/watch?v=..." : "https://"} />
                    </label>

                    {isVideo ? (
                        ytId(v.link) && (
                            <div className="col-span-full aspect-video max-w-[320px] overflow-hidden rounded-xl border border-[var(--line)] bg-black">
                                <img src={`https://i.ytimg.com/vi/${ytId(v.link)}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" />
                            </div>
                        )
                    ) : (
                        <div className="col-span-full grid gap-3 min-[700px]:grid-cols-[1fr_200px]">
                            <div className="grid gap-3">
                                <label className={labelCls}>Image link <small className="font-medium text-[var(--mute)]">GitHub / jsDelivr URL</small>
                                    <input className={field} value={v.image} onChange={set("image")}
                                        placeholder="https://cdn.jsdelivr.net/gh/user/repo@main/images/offer.png" />
                                </label>
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <span className="text-[13px] text-[var(--mute)]">or</span>
                                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={upload} className="hidden" id="aff-file" />
                                    <button type="button" className={btn} onClick={() => fileRef.current?.click()} disabled={uploading}>
                                        {uploading ? "Uploading…" : "Upload image"}
                                    </button>
                                    {v.image && <button type="button" className={btn} onClick={() => setV((s) => ({ ...s, image: "" }))}>Remove image</button>}
                                </div>
                            </div>
                            <div className="grid aspect-[3/4] max-h-[200px] place-items-center overflow-hidden rounded-xl border border-dashed border-[var(--line)] bg-[var(--grey-t)] text-[13px] text-[var(--mute)]">
                                {v.image ? <img src={v.image} alt="" className="h-full w-full object-contain" /> : "Image preview"}
                            </div>
                        </div>
                    )}

                    {/* which jobs show this item */}
                    <div className="col-span-full">
                        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                            <b className="text-sm">Show on these jobs <span className="font-medium text-[var(--mute)]">({v.jobIds.length} selected)</span></b>
                            <div className="flex gap-2">
                                <button type="button" className={btn} onClick={() => setV((s) => ({ ...s, jobIds: jobs.map((j) => j.id) }))}>Select all</button>
                                <button type="button" className={btn} onClick={() => setV((s) => ({ ...s, jobIds: [] }))}>Clear</button>
                            </div>
                        </div>
                        <input className={`${field} mb-2`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company or role" aria-label="Search jobs" />
                        <div className="max-h-64 overflow-y-auto rounded-xl border border-[var(--line)] p-1.5">
                            {shownJobs.length ? shownJobs.map((j) => (
                                <label key={j.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] hover:bg-[var(--grey-t)]">
                                    <input type="checkbox" className="mt-0.5" checked={v.jobIds.includes(j.id)} onChange={() => toggleJob(j.id)} />
                                    <span><b>{j.company}</b> – {j.role}</span>
                                </label>
                            )) : <div className="px-3 py-4 text-center text-[13px] text-[var(--mute)]">No jobs found.</div>}
                        </div>
                        {!v.jobIds.length && <p className="mb-0 mt-2 text-[13px] text-[var(--mute)]">Not shown anywhere until you tick at least one job.</p>}
                    </div>
                </div>

                <div className="mt-5 flex justify-end gap-2.5">
                    {editId && <button type="button" className={btn} onClick={() => { setV(EMPTY); setEditId(null); }}>Cancel edit</button>}
                    <button type="submit" disabled={saving} className={`${btn} ${btnP} disabled:opacity-70`}>
                        <IconPlusSm size={16} /> {saving ? "Saving…" : editId ? "Save changes" : isVideo ? "Add video" : "Add book / offer"}
                    </button>
                </div>
            </form>

            <div className={panel}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
                    <h2 className="m-0 text-base">All books &amp; videos ({list.length})</h2>
                    <div className="flex gap-2" role="tablist">
                        <button type="button" role="tab" aria-selected={tab === "offer"}
                            className={`${btn} ${tab === "offer" ? btnP : ""}`} onClick={() => setTab("offer")}>
                            Books / offers ({offers.length})
                        </button>
                        <button type="button" role="tab" aria-selected={tab === "video"}
                            className={`${btn} ${tab === "video" ? btnP : ""}`} onClick={() => setTab("video")}>
                            Videos ({videos.length})
                        </button>
                    </div>
                </div>

                {visible.length ? visible.map((x) => {
                    const ids = x.jobIds || [];
                    const names = ids.map(jobName).filter(Boolean);
                    return (
                        <div key={x.id} className="flex flex-wrap items-center gap-4 border-b border-[var(--line)] px-5 py-3.5 last:border-b-0">
                            <div className="h-14 w-24 flex-none overflow-hidden rounded-lg bg-[var(--grey-t)]">
                                {x.kind === "video"
                                    ? ytId(x.link) && <img src={`https://i.ytimg.com/vi/${ytId(x.link)}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" />
                                    : x.image && <img src={x.image} alt="" className="h-full w-full object-contain" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <b className="block truncate">{x.title}</b>
                                <span className="block truncate text-[13.5px] text-[var(--mute)]">{x.link}</span>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                    <span className={ids.length ? chip.grey : chip.no} title={names.join(", ")}>
                                        {ids.length ? `${ids.length} job${ids.length > 1 ? "s" : ""}` : "No jobs selected"}
                                    </span>
                                    <span className={x.active === false ? chip.no : chip.ok}>{x.active === false ? "Hidden" : "Live"}</span>
                                </div>
                            </div>
                            <div className="flex gap-1.5">
                                <button type="button" className={btn} onClick={() => toggle(x)}>{x.active === false ? "Show" : "Hide"}</button>
                                <button type="button" className={`${btn} ${btnI}`} aria-label={`Edit ${x.title}`} onClick={() => edit(x)}><IconEdit size={16} /></button>
                                <button type="button" className={`${btn} ${btnI} hover:!border-[#efb9b2] hover:!bg-[var(--red-t)] hover:!text-[var(--red)]`}
                                    aria-label={`Delete ${x.title}`} onClick={() => remove(x)}><IconTrash size={16} /></button>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="px-5 py-[34px] text-center text-[var(--mute)]">
                        <b className="block text-[var(--ink)]">No {tab === "video" ? "videos" : "books / offers"} yet</b>
                        Add one using the form above.
                    </div>
                )}
            </div>
        </>
    );
}