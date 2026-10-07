// Service worker: shows push notifications and opens the job page when clicked.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
    let d = {};
    try { d = event.data ? event.data.json() : {}; } catch { d = { title: "New job alert", body: event.data?.text() || "" }; }
    event.waitUntil(
        self.registration.showNotification(d.title || "New job alert", {
            body: d.body || "",
            data: { url: d.url || "/" },
            icon: "/favicon.ico",
        })
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = event.notification.data?.url || "/";
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
            for (const c of list) {
                if (c.url === url && "focus" in c) return c.focus();
            }
            return self.clients.openWindow(url);
        })
    );
});