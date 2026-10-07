import { useState } from "react";
import { useAdmin } from "./AdminContext";
import { btn, btnP, field, labelCls, Mark } from "./ui";
import { SITE_NAME } from "../site";

export default function AdminLogin() {
  const { login, lockMsg } = useAdmin();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const msg = await login(pw);
    setBusy(false);
    if (msg) setErr(msg);
  };

  return (
    <div className="grid min-h-screen bg-[var(--card)] min-[900px]:grid-cols-[1.1fr_1fr]">
      <div className="hidden flex-col justify-between bg-[var(--side)] p-14 text-white min-[900px]:flex"
        style={{ backgroundImage: "radial-gradient(900px 500px at 10% 100%,rgba(15,139,141,.45),transparent 60%)" }}>
        <div className="flex items-center gap-2.5 text-[17px] font-extrabold tracking-[-.01em]">
          <Mark /> {SITE_NAME}
        </div>
        <div>
          <h2 className="mb-3 mt-0 max-w-[14ch] text-4xl leading-[1.15] tracking-[-.02em]">Manage every listing in one place.</h2>
          <p className="m-0 max-w-[38ch] text-[var(--side-ink)]">Add jobs, update them, and see which ones get the most apply clicks.</p>
        </div>
      </div>

      <div className="grid place-items-center p-8">
        <form onSubmit={submit} className="w-[min(360px,100%)]">
          <h1 className="mb-1 mt-0 text-2xl tracking-[-.02em]">Admin sign in</h1>
          <p className="mb-5 mt-0 text-[var(--mute)]">Enter the admin password to continue.</p>
          <label className={labelCls}>
            Password
            <input className={field} type="password" value={pw} onChange={(e) => setPw(e.target.value)}
              autoComplete="current-password" required autoFocus />
          </label>
          <p role="alert" className="mx-0 mb-0 mt-2 min-h-5 text-[13px] text-[var(--red)]">{err || lockMsg}</p>
          <button type="submit" disabled={busy} className={`${btn} ${btnP} mt-1.5 w-full justify-center disabled:opacity-70`}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}