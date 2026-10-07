function visitorId() {
    try {
        let v = localStorage.getItem("js-visitor");
        if (!v) {
            v = crypto.randomUUID();
            localStorage.setItem("js-visitor", v);
        }
        return v;
    } catch {
        return "anon";
    }
}

export function trackClick(job) {
    if (!job?.id) return;
    try {
        const data = JSON.stringify({ id: job.id, visitor: visitorId() });
        if (!navigator.sendBeacon?.("/api/click", data)) {
            fetch("/api/click", { method: "POST", body: data, keepalive: true });
        }
    } catch { }
}