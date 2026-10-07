import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/* Holds everything the admin pages share: session, jobs, clicks and toasts. */
const Ctx = createContext(null);
export const useAdmin = () => useContext(Ctx);

const newId = () =>
  crypto.randomUUID ? crypto.randomUUID() : "j" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function AdminProvider({ children }) {
  const tokenRef = useRef("");
  // "boot" = checking saved session, "locked" = show login, "ready" = signed in
  const [status, setStatus] = useState(() => {
    try { tokenRef.current = sessionStorage.getItem("jsToken") || ""; } catch { }
    return tokenRef.current ? "boot" : "locked";
  });
  const [lockMsg, setLockMsg] = useState("");
  const [jobs, setJobs] = useState([]);
  const [clicks, setClicks] = useState({});
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((text, bad) => {
    const id = newId();
    setToasts((t) => [...t, { id, text, bad }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), bad ? 6000 : 3200);
  }, []);

  const api = useCallback(
    (path, body) =>
      fetch(path, {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + tokenRef.current },
        body: body ? JSON.stringify(body) : undefined,
      }),
    []
  );

  const lock = useCallback((msg = "") => {
    setLockMsg(msg);
    setStatus("locked");
  }, []);

  const loadClicks = useCallback(async () => {
    try {
      const r = await api("/api/clicks");
      if (r.status === 401) return lock("Session expired. Sign in again.");
      if (r.ok) setClicks(await r.json());
      else {
        setClicks({});
        toast("Click tracking is not set up on the server yet (/api/clicks).", true);
      }
    } catch {
      setClicks({});
      toast("Could not load clicks. Is the server running?", true);
    }
  }, [api, lock, toast]);

  const persist = useCallback(
    async (list, silent) => {
      try {
        const r = await api("/api/jobs", list);
        if (r.status === 401) { lock("Session expired. Sign in again."); return false; }
        const d = await r.json();
        if (r.ok) {
          if (!silent) toast(`Saved. ${d.count} jobs are live on the website.`);
          return true;
        }
        toast("Could not save: " + (d.error || "unknown error"), true);
      } catch {
        toast("Could not reach the server. Is it running?", true);
      }
      return false;
    },
    [api, lock, toast]
  );

  const start = useCallback(async () => {
    let list = [];
    try {
      const r = await fetch("/jobs.json?v=" + Date.now(), { cache: "no-store" });
      list = r.ok ? await r.json() : [];
    } catch {
      toast("Could not load jobs.json. Is the server running?", true);
    }
    if (!Array.isArray(list)) list = [];
    let fixed = false;
    list = list.map((j) => (j.id ? j : ((fixed = true), { ...j, id: newId() })));
    setJobs(list);
    setStatus("ready");
    loadClicks();
    if (fixed) persist(list, true);
  }, [loadClicks, persist, toast]);

  // returns an error message, or "" on success
  const login = useCallback(
    async (password) => {
      try {
        const r = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const d = await r.json();
        if (!r.ok) return d.error || "Wrong password. Try again.";
        tokenRef.current = d.token;
        try { sessionStorage.setItem("jsToken", d.token); } catch { }
        await start();
        return "";
      } catch {
        return "Server not running. Run start.bat, then open the admin page again.";
      }
    },
    [start]
  );

  const logout = useCallback(() => {
    try { sessionStorage.removeItem("jsToken"); } catch { }
    tokenRef.current = "";
    setJobs([]);
    lock("");
  }, [lock]);

  // restore a saved session on first load
  useEffect(() => {
    if (!tokenRef.current) return;
    api("/api/ping").then((r) => (r.ok ? start() : lock(""))).catch(() => lock(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- job actions (each saves to the server) ---------- */
  const addJob = (job) => {
    const next = [{ ...job, id: newId() }, ...jobs];
    setJobs(next);
    return persist(next);
  };
  const updateJob = (id, job) => {
    const next = jobs.map((j) => (j.id === id ? { ...job, id } : j));
    setJobs(next);
    return persist(next);
  };
  const deleteJob = (id) => {
    const next = jobs.filter((j) => j.id !== id);
    setJobs(next);
    return persist(next);
  };

  const clicksOf = (j) => {
    const c = clicks[j.id];
    return +(c && c.total != null ? c.total : c) || 0;
  };

  const value = { status, lockMsg, jobs, clicks, toasts, toast, login, logout, loadClicks, addJob, updateJob, deleteJob, clicksOf };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
