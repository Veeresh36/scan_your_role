// vite-admin-plugin.js
// Dev-only admin API: jobs, affiliates, image upload, unique apply clicks,
// and web-push notifications when a new job is added.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import webpush from "web-push";
import { loadEnv } from "vite";

export default function adminApi({
    password = process.env.ADMIN_PASSWORD || "admin123",
    env = {},
    file = "public/jobs.json",
    affiliatesFile = "public/affiliates.json",
    imagesDir = "public/affiliates",
    clicksFile = "clicks.json",
} = {}) {
    const root = process.cwd();
    const jobsPath = path.resolve(root, file);
    const affPath = path.resolve(root, affiliatesFile);
    const imgDir = path.resolve(root, imagesDir);
    const clicksPath = path.resolve(root, clicksFile);

    // Token is derived from the password, so it stays valid after a dev-server
    // restart. Changing the password signs everyone out.
    const TOKEN = crypto.createHmac("sha256", String(password)).update("admin-session").digest("hex");

    const send = (res, code, data) => {
        res.statusCode = code;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(data));
    };

    const readBody = (req) =>
        new Promise((resolve, reject) => {
            let s = "";
            req.on("data", (c) => {
                s += c;
                if (s.length > 6e6) {
                    reject(new Error("Request too large"));
                    req.destroy();
                }
            });
            req.on("end", () => {
                try {
                    resolve(s ? JSON.parse(s) : null);
                } catch (e) {
                    reject(e);
                }
            });
            req.on("error", reject);
        });

    const authed = (req) => {
        const given = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
        const a = Buffer.from(given);
        const b = Buffer.from(TOKEN);
        return a.length === b.length && crypto.timingSafeEqual(a, b);
    };

    // Write straight to the file. A temp file + rename fails on Windows (EPERM)
    // whenever the watcher, antivirus or an editor has the target open.
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const writeJson = async (p, data) => {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        const text = JSON.stringify(data, null, 2) + "\n";
        let lastErr;
        for (let i = 0; i < 5; i++) {
            try {
                fs.writeFileSync(p, text);
                return;
            } catch (e) {
                lastErr = e;
                if (!["EPERM", "EBUSY", "EACCES"].includes(e.code)) throw e;
                await sleep(100 * (i + 1));
            }
        }
        throw lastErr;
    };

    const readClicks = () => {
        try {
            return JSON.parse(fs.readFileSync(clicksPath, "utf8")) || {};
        } catch {
            return {};
        }
    };

    const isListOfObjects = (l) =>
        Array.isArray(l) && l.every((j) => j && typeof j === "object" && !Array.isArray(j));

    /* ------------------------------------------------------------------ */
    /* Push notifications                                                  */
    /* ------------------------------------------------------------------ */

    // must match the slug used on the site (JobDetails.jsx / LandingPage.jsx)
    const slugOf = (j) =>
        `${j.company}-${j.role}-${j.posted}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const readJson = (p) => {
        try {
            return JSON.parse(fs.readFileSync(p, "utf8"));
        } catch {
            return [];
        }
    };

    let SB_URL = "";
    let SB_SERVICE = "";
    let sbHeaders = {};
    const setup = (e) => {
        SB_URL = (e.VITE_SUPABASE_URL || "").trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
        SB_SERVICE = (e.SUPABASE_SERVICE_KEY || "").trim();
        sbHeaders = {
            apikey: SB_SERVICE,
            // legacy JWT keys need Authorization; new sb_secret_ keys must not send it
            ...(SB_SERVICE.startsWith("eyJ") ? { Authorization: `Bearer ${SB_SERVICE}` } : {}),
            "Content-Type": "application/json",
        };
    };
    setup(env);

    const notifyNewJobs = async (jobs) => {
        const pub = (env.VITE_VAPID_PUBLIC_KEY || "").trim();
        const priv = (env.VAPID_PRIVATE_KEY || "").trim();
        console.log("[push] env check:", { url: !!SB_URL, service: !!SB_SERVICE, pub: !!pub, priv: !!priv });
        if (!SB_URL || !SB_SERVICE || !pub || !priv) {
            console.warn("[push] skipped: missing SUPABASE_SERVICE_KEY or VAPID keys in env");
            return;
        }
        webpush.setVapidDetails("mailto:admin@localhost.dev", pub, priv);

        const r = await fetch(`${SB_URL}/rest/v1/push_subscriptions?select=id,subscription`, { headers: sbHeaders });
        if (!r.ok) return console.error("[push] could not read subscriptions:", r.status, await r.text());
        const subs = await r.json();

        const site = (env.SITE_URL || "http://localhost:5173").replace(/\/+$/, "");
        const first = jobs[0];
        const payload = JSON.stringify(
            jobs.length === 1
                ? {
                    title: `New job: ${first.role}`,
                    body: `${first.company}${first.location ? " · " + first.location : ""}`,
                    url: `${site}/job?id=${slugOf(first)}`,
                }
                : { title: `${jobs.length} new jobs added`, body: "Tap to see the latest openings.", url: `${site}/#jobs` }
        );

        let sent = 0,
            removed = 0;
        await Promise.all(
            subs.map(async (s) => {
                try {
                    await webpush.sendNotification(s.subscription, payload);
                    sent++;
                } catch (e) {
                    if (e.statusCode === 404 || e.statusCode === 410) {
                        // subscription expired or was revoked: clean it up
                        removed++;
                        await fetch(`${SB_URL}/rest/v1/push_subscriptions?id=eq.${s.id}`, {
                            method: "DELETE",
                            headers: sbHeaders,
                        });
                    } else {
                        console.error("[push] send failed:", e.statusCode || "", e.body || e.message);
                    }
                }
            })
        );
        console.log(`[push] ${jobs.length} new job(s): sent ${sent}, removed ${removed} dead, total ${subs.length}`);
    };

    return {
        name: "admin-api",
        apply: "serve", // dev server only

        // Load ALL .env keys (not just VITE_ ones) so the plugin works even if
        // vite.config.js does not pass env in.
        configResolved(config) {
            env = { ...loadEnv(config.mode, config.envDir || root, ""), ...env };
            setup(env);
        },

        // Saving writes data files (and a .tmp file first). Tell Vite not to
        // full-reload the page when they change, or the save gets interrupted.
        config() {
            return {
                server: {
                    watch: {
                        ignored: [
                            "**/public/**/*.json",
                            "**/public/**/*.tmp",
                            "**/clicks.json",
                            "**/clicks.json.tmp",
                        ],
                    },
                },
            };
        },

        configureServer(server) {
            server.middlewares.use("/api", async (req, res) => {
                const route = req.url.split("?")[0];
                try {
                    if (route === "/login" && req.method === "POST") {
                        const body = await readBody(req);
                        if (!body || body.password !== password)
                            return send(res, 401, { error: "Wrong password. Try again." });
                        return send(res, 200, { token: TOKEN });
                    }

                    // public: visitors press Apply (counted once per visitor per job)
                    if (route === "/click" && req.method === "POST") {
                        const body = await readBody(req);
                        const id = body && String(body.id || "").slice(0, 100);
                        const visitor = body && String(body.visitor || "anon").slice(0, 100);
                        if (!id) return send(res, 400, { error: "Missing id" });
                        const clicks = readClicks();
                        const seen = Array.isArray(clicks[id]) ? clicks[id] : [];
                        if (!seen.includes(visitor)) seen.push(visitor);
                        clicks[id] = seen;
                        await writeJson(clicksPath, clicks);
                        return send(res, 200, { ok: true });
                    }

                    if (!authed(req)) return send(res, 401, { error: "Not signed in. Log in to the admin again." });

                    if (route === "/ping") return send(res, 200, { ok: true });

                    if (route === "/clicks") {
                        const raw = readClicks();
                        const counts = {};
                        for (const k in raw) counts[k] = Array.isArray(raw[k]) ? raw[k].length : 0;
                        return send(res, 200, counts);
                    }

                    if (route === "/jobs" && req.method === "POST") {
                        const list = await readBody(req);
                        if (!isListOfObjects(list)) return send(res, 400, { error: "Jobs must be a list of objects" });

                        // a job is "new" if its slug was not in the old file and it has not expired
                        const before = readJson(jobsPath);
                        const seen = new Set((Array.isArray(before) ? before : []).map(slugOf));
                        const fresh = list.filter(
                            (j) => !seen.has(slugOf(j)) && !(j.deadline && new Date(j.deadline) < new Date())
                        );

                        await writeJson(jobsPath, list);

                        if (fresh.length) {
                            setTimeout(
                                () => notifyNewJobs(fresh).catch((e) => console.error("[push] error:", e)),
                                Number(env.NOTIFY_DELAY_MS) || 0
                            );
                        }
                        return send(res, 200, { ok: true, count: list.length, notified: fresh.length });
                    }

                    if (route === "/affiliates" && req.method === "POST") {
                        const list = await readBody(req);
                        if (!isListOfObjects(list)) return send(res, 400, { error: "Affiliates must be a list of objects" });
                        await writeJson(affPath, list);
                        return send(res, 200, { ok: true, count: list.length });
                    }

                    if (route === "/upload" && req.method === "POST") {
                        const body = await readBody(req);
                        const m = body && /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/.exec(body.data || "");
                        if (!m) return send(res, 400, { error: "Use a PNG, JPG, WEBP or GIF image" });
                        const buf = Buffer.from(m[2], "base64");
                        if (buf.length > 3 * 1024 * 1024) return send(res, 400, { error: "Image must be under 3 MB" });
                        const ext = m[1] === "jpeg" ? "jpg" : m[1];
                        const base =
                            String(body.name || "image").replace(/\.[^.]+$/, "").toLowerCase()
                                .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "image";
                        const fname = `${base}-${Date.now().toString(36)}.${ext}`;
                        fs.mkdirSync(imgDir, { recursive: true });
                        fs.writeFileSync(path.join(imgDir, fname), buf);
                        return send(res, 200, { url: `/affiliates/${fname}` });
                    }

                    return send(res, 404, { error: "Not found" });
                } catch (e) {
                    return send(res, 500, { error: e.message || "Server error" });
                }
            });
        },
    };
}