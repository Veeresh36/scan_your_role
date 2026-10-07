import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY;

const log = (...a) => console.log("[NotifyButton]", ...a);

// VAPID public key (base64url) -> Uint8Array, as the browser requires
const toKey = (b64) => {
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

// true when an existing subscription was made with the same VAPID public key
const sameKey = (sub, key) => {
    const k = sub?.options?.applicationServerKey;
    if (!k) return false;
    const a = new Uint8Array(k);
    return a.length === key.length && a.every((v, i) => v === key[i]);
};

const save = async (sub) => {
    const json = sub.toJSON();
    const headers = {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
    };
    const post = (body) =>
        fetch(`${SB_URL}/rest/v1/push_subscriptions`, { method: "POST", headers, body: JSON.stringify(body) });

    // Layout 1: separate columns
    let r = await post({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth });
    if (r.ok || r.status === 409) return "saved";
    const first = `${r.status} ${await r.text()}`;
    log("layout 1 failed:", first);

    // Layout 2: one "subscription" json column
    r = await post({ endpoint: json.endpoint, subscription: json });
    if (r.ok || r.status === 409) return "saved";
    const second = `${r.status} ${await r.text()}`;
    log("layout 2 failed:", second);

    throw new Error(`Supabase did not save it. Try 1: ${first.slice(0, 160)} | Try 2: ${second.slice(0, 160)}`);
};

export default function NotifyButton({ className = "" }) {
    const [state, setState] = useState("idle"); // idle | on | busy | denied | unsupported
    const [toast, setToast] = useState(null); // { text, bad }
    const timer = useRef(0);

    const say = (text, bad = false) => {
        log(bad ? "ERROR:" : "info:", text);
        setToast({ text, bad });
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setToast(null), bad ? 20000 : 7000);
    };
    useEffect(() => () => clearTimeout(timer.current), []);

    const supported =
        typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

    useEffect(() => {
        if (!supported) return setState("unsupported");
        if (Notification.permission === "denied") return setState("denied");
        navigator.serviceWorker
            .getRegistration("/sw.js")
            .then((reg) => reg?.pushManager.getSubscription())
            .then((sub) => sub && setState("on"))
            .catch(() => { });
    }, [supported]);

    const enable = async () => {
        if (!supported) {
            return say(
                "Job alerts need HTTPS. On iPhone: tap Share, then Add to Home Screen, and open the app from your Home Screen. On Android: use Chrome.",
                true
            );
        }
        setState("busy");
        try {
            log("step 1: checking .env keys", { url: !!SB_URL, anon: !!SB_KEY, vapid: !!VAPID });
            if (!VAPID || !SB_URL || !SB_KEY)
                throw new Error("A VITE_ key is missing. Check .env names, then stop and restart `npm run dev`.");

            log("step 2: asking permission, current =", Notification.permission);
            const perm = await Notification.requestPermission();
            if (perm !== "granted") {
                setState(perm === "denied" ? "denied" : "idle");
                return say(
                    perm === "denied"
                        ? "Notifications are blocked for this site. Click the lock icon in the address bar, set Notifications to Allow, then try again."
                        : "The permission popup was closed without choosing Allow. Click the button again and press Allow.",
                    true
                );
            }

            log("step 3: registering /sw.js");
            const reg = await navigator.serviceWorker.register("/sw.js");
            await navigator.serviceWorker.ready;

            log("step 4: subscribing to push");
            const key = toKey(VAPID);
            let sub = await reg.pushManager.getSubscription();
            if (sub && !sameKey(sub, key)) {
                log("old subscription used a different VAPID key, replacing it");
                await sub.unsubscribe();
                sub = null;
            }
            if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });

            log("step 5: saving to Supabase");
            await save(sub);

            log("step 6: showing a local test notification");
            await reg.showNotification("Job alerts are on", {
                body: "You will get a notification when a new job is added.",
                icon: "/favicon.ico",
                data: { url: "/" },
            });

            setState("on");
            say("Job alerts are on! We'll notify you when new jobs are added.");
        } catch (e) {
            console.error("[NotifyButton]", e);
            setState("idle");
            say(`${e.name && e.name !== "Error" ? e.name + ": " : ""}${e.message || "Something went wrong"}`, true);
        }
    };

    if (state === "unsupported") return null;

    const icon = state === "denied" ? "🔕" : "🔔";
    const text =
        state === "on" ? "Alerts on"
            : state === "busy" ? "Please wait…"
                : state === "denied" ? "Blocked"
                    : "Get job alerts";

    return (
        <>
            <button
                type="button"
                onClick={enable}
                disabled={state === "busy"}
                aria-label={text}
                title={text}
                className={className}
            >
                <span aria-hidden="true">{icon}</span>
                <span className="max-sm:hidden">{text}</span>
            </button>

            {toast &&
                createPortal(
                    <div role="alert" className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4">
                        <div
                            className={`pointer-events-auto flex max-w-[560px] items-start gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl ${toast.bad ? "bg-red-600 text-white" : "bg-[var(--ink)] text-[var(--bg)]"}`}
                        >
                            <span className="break-words">{toast.text}</span>
                            <button
                                type="button"
                                onClick={() => setToast(null)}
                                aria-label="Dismiss"
                                className="cursor-pointer border-0 bg-transparent p-0 text-base leading-none text-inherit opacity-80 hover:opacity-100"
                            >
                                ✕
                            </button>
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}