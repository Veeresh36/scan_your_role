import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAdmin } from "../admin/AdminContext";
import { btn, btnP, field, labelCls } from "../admin/ui";

const todayStr = () => new Date().toISOString().slice(0, 10);
const EMPTY = {
  sector: "Private", company: "", role: "", cat: "Tech", type: "Full-Time", location: "",
  experience: "", exp: "fresher", eligibility: "", vacancies: "", salary: "", posted: "", deadline: "",
  description: "", link: "", thumbnail: "",
  about: "", responsibilities: "", eligibilityPoints: "", skills: "", startDate: "", examDate: "", feeDate: "",
  vacancyTable: "", ageLimit: "", ageRelaxation: "", importantLinks: "",
  howToApply: "", selection: "", documents: "", fee: "", notification: "", prep: "", faqs: "",
};

const CATS = {
  Private: ["Tech", "Non-Tech"],
  Government: ["Banking", "Railways", "Defence", "Police", "Teaching", "SSC / UPSC", "PSU", "Healthcare", "Tech", "Non-Tech", "Other"],
};
const TYPES = ["Full-Time", "Part-Time", "Internship", "Apprenticeship", "Contract", "Remote"];
const isGov = (s) => s === "Government";

const Sec = ({ title, sub, children }) => (
  <div className="mb-[18px] rounded-xl border border-[var(--line)] bg-[var(--card)] p-6 shadow-[var(--sh)]">
    <h2 className="m-0 text-base tracking-[-.01em]">{title}</h2>
    <p className="mb-[18px] mt-0.5 text-[13.5px] text-[var(--mute)]">{sub}</p>
    <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-x-5 gap-y-4">{children}</div>
  </div>
);

const Opt = () => <small className="font-medium text-[var(--mute)]"> Optional</small>;

// optional full-width text area with a short hint underneath
const Area = ({ label, hint, value, onChange, rows = 4, placeholder }) => (
  <label className={`${labelCls} col-span-full`}>
    <span>{label} <Opt /></span>
    <textarea className={`${field} min-h-[96px] resize-y`} rows={rows} value={value || ""} onChange={onChange} placeholder={placeholder} />
    {hint && <small className="font-medium text-[var(--mute)]">{hint}</small>}
  </label>
);

function JobForm({ initial, editing, onSubmit, onCancel, notice }) {
  const [v, setV] = useState({ ...initial, sector: isGov(initial.sector) ? "Government" : "Private" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const gov = isGov(v.sector);

  // switching sector swaps the category list, so keep the category valid
  const setSector = (e) => {
    const sector = e.target.value;
    setV((s) => ({ ...s, sector, cat: CATS[sector].includes(s.cat) ? s.cat : CATS[sector][0] }));
  };

  // keep an existing category selectable even if it is not in the preset list
  const catList = CATS[v.sector].includes(v.cat) || !v.cat ? CATS[v.sector] : [v.cat, ...CATS[v.sector]];

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await onSubmit({ ...v, thumbnail: (v.thumbnail || "").trim(), notification: (v.notification || "").trim() });
    } catch (ex) {
      setErr(ex?.message || "Could not save. Make sure the dev server is running and you are signed in.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Sec title="Job basics" sub="What the job is and where it is.">
        <div className={`${labelCls} col-span-full`}>
          <span>Job sector</span>
          <div className="mt-1.5 grid max-w-[360px] grid-cols-2 gap-1 rounded-xl border border-[var(--line)] bg-[var(--bg)] p-1" role="radiogroup" aria-label="Job sector">
            {["Private", "Government"].map((s) => (
              <button key={s} type="button" role="radio" aria-checked={v.sector === s}
                onClick={() => setSector({ target: { value: s } })}
                className={`min-h-[40px] cursor-pointer rounded-lg border-0 px-3 text-sm font-bold transition ${v.sector === s ? "bg-[var(--card)] text-[var(--brand)] shadow-[var(--sh)]" : "bg-transparent text-[var(--mute)] hover:text-[var(--ink)]"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <label className={labelCls}>{gov ? "Organization / Department" : "Company"}
          <input className={field} value={v.company} onChange={set("company")} required placeholder={gov ? "e.g. State Bank of India" : ""} />
        </label>
        <label className={labelCls}>{gov ? "Post name" : "Role"}
          <input className={field} value={v.role} onChange={set("role")} required placeholder={gov ? "e.g. Probationary Officer" : ""} />
        </label>
        <label className={labelCls}>Category
          <select className={field} value={v.cat} onChange={set("cat")}>
            {catList.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className={labelCls}>Job type
          <select className={field} value={v.type} onChange={set("type")}>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className={labelCls}>Location
          <input className={field} value={v.location} onChange={set("location")} required placeholder={gov ? "e.g. All India" : ""} />
        </label>
      </Sec>

      <Sec title="Requirements and dates" sub="Who can apply and for how long.">
        <label className={labelCls}>Experience
          <input className={field} value={v.experience} onChange={set("experience")} placeholder={gov ? "Freshers / 0 years" : "0–2 years"} required />
        </label>
        <label className={labelCls}>Level
          <select className={field} value={v.exp} onChange={set("exp")}><option value="fresher">Fresher</option><option value="exp">Experienced</option></select>
        </label>
        <label className={labelCls}>{gov ? "Qualification / Eligibility" : "Eligibility"}
          <input className={field} value={v.eligibility} onChange={set("eligibility")} placeholder={gov ? "Any graduate, age 21–30" : "Any graduate"} />
        </label>
        <label className={labelCls}><span>Vacancies <Opt /></span>
          <input className={field} value={v.vacancies} onChange={set("vacancies")} placeholder={gov ? "e.g. 450" : "e.g. 10"} />
        </label>
        <label className={labelCls}><span>{gov ? "Salary / Pay scale" : "Salary"} <Opt /></span>
          <input className={field} value={v.salary} onChange={set("salary")} placeholder={gov ? "₹35,000 – ₹1,12,000" : "₹4–6 LPA"} />
        </label>
        <label className={labelCls}>Posted date<input className={field} type="date" value={v.posted} onChange={set("posted")} required /></label>
        <label className={labelCls}>
          <span>Last date {gov ? <small className="font-medium text-[var(--mute)]">Required for govt jobs</small> : <Opt />}</span>
          <input className={field} type="date" value={v.deadline} onChange={set("deadline")} required={gov} />
        </label>
        <label className={labelCls}><span>Application start date <Opt /></span>
          <input className={field} type="date" value={v.startDate || ""} onChange={set("startDate")} />
        </label>
        <label className={labelCls}><span>Fee payment last date <Opt /></span>
          <input className={field} type="date" value={v.feeDate || ""} onChange={set("feeDate")} />
        </label>
        <label className={labelCls}><span>Exam date <Opt /></span>
          <input className={field} type="date" value={v.examDate || ""} onChange={set("examDate")} />
        </label>
      </Sec>

      <Sec title="Description and apply link" sub="The description shows on the job detail page.">
        <label className={`${labelCls} col-span-full`}>
          <span>Job description <Opt /></span>
          <textarea className={`${field} min-h-[120px] resize-y`} rows={5} value={v.description || ""} onChange={set("description")}
            placeholder="What the job is about, in a few paragraphs." />
          <small className="font-medium text-[var(--mute)]">You can use # heading, * bullet and **bold**. Responsibilities, eligibility and skills have their own boxes below.</small>
        </label>
        <label className={`${labelCls} col-span-full`}>{gov ? "Official apply / notification link" : "Apply link"}
          <input className={field} type="url" value={v.link} onChange={set("link")} required placeholder="https://" />
        </label>
        <label className={`${labelCls} col-span-full`}>
          <span>Official notification link <Opt /></span>
          <input className={field} type="url" value={v.notification || ""} onChange={set("notification")} placeholder="https://… (PDF or notice page)" />
        </label>
        <label className={`${labelCls} col-span-full`}>
          <span>Thumbnail image URL <Opt /></span>
          <input className={field} value={v.thumbnail || ""} onChange={set("thumbnail")}
            placeholder="https://example.com/logo.png" />
        </label>
        {v.thumbnail && (
          <div className="col-span-full flex items-center gap-3 text-[13px] text-[var(--mute)]">
            <img key={v.thumbnail} src={v.thumbnail} alt="Thumbnail preview" referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
              className="h-16 w-16 rounded-xl border border-[var(--line)] object-cover" />
            <span>Preview. If nothing shows, the link is not a direct image URL.</span>
          </div>
        )}
      </Sec>

      <Sec title="Page sections" sub="Fill what you have. A section with nothing in it does not show on the job page.">
        <Area label="About this recruitment" rows={5} value={v.about} onChange={set("about")}
          hint="Your own explanation of this recruitment." />
        <Area label="Responsibilities" value={v.responsibilities} onChange={set("responsibilities")}
          hint="One per line." placeholder={"Manage daily branch operations\nLead the team"} />
        <Area label="Vacancy details" value={v.vacancyTable} onChange={set("vacancyTable")}
          hint="One per line: Post name | Number of posts. A total row is added automatically."
          placeholder={"Principal (RPC) | 216\nPrincipal (KK) | 31"} />
        <Area label="Eligibility points" value={v.eligibilityPoints} onChange={set("eligibilityPoints")}
          hint="One per line. Experience and other requirements." placeholder={"Any graduate\nIndian citizen"} />
        <Area label="Age limit" rows={3} value={v.ageLimit} onChange={set("ageLimit")}
          hint="One per line." placeholder={"Minimum age: 21 years\nMaximum age: 30 years"} />
        <Area label="Age relaxation" rows={3} value={v.ageRelaxation} onChange={set("ageRelaxation")}
          hint="One per line." placeholder={"SC / ST: 5 years\nOBC: 3 years\nPwD: 10 years"} />
        <Area label="Required skills" rows={2} value={v.skills} onChange={set("skills")}
          hint="Separate with commas or put one per line." placeholder="Communication, MS Office, Banking operations" />
        <Area label="Application fee" rows={4} value={v.fee} onChange={set("fee")}
          hint="One per line: Category | Fee. Shows as a table. Or just write Free."
          placeholder={"General / OBC | ₹750\nSC / ST | ₹0\nPwD | ₹500\nPayment mode | Online"} />
        <Area label="Selection process" value={v.selection} onChange={set("selection")}
          hint="One stage per line, in order." placeholder={"Written exam\nInterview\nDocument verification"} />
        <Area label="Documents required" value={v.documents} onChange={set("documents")}
          hint="One per line." placeholder={"Passport size photo\nSignature\nEducation certificates"} />
        <Area label="How to apply" value={v.howToApply} onChange={set("howToApply")}
          hint="One step per line. Use Title: details. The section is hidden when empty."
          placeholder={"Visit the website: Open the official recruitment site\nRegister: Create an account and log in\nFill the form: Add your details and upload documents\nPay the fee: Pay online if a fee applies\nSubmit: Save a copy of the application"} />
        <Area label="Important links" rows={4} value={v.importantLinks} onChange={set("importantLinks")}
          hint="One per line: Label | https://link. The notification link and apply link are added for you."
          placeholder={"Detailed advertisement | https://...\nOfficial website | https://..."} />
        <Area label="Preparation guide" rows={6} value={v.prep} onChange={set("prep")}
          hint="Your own tips and guidance. You can use # heading, * bullet and **bold**." />
        <Area label="FAQs" rows={7} value={v.faqs} onChange={set("faqs")}
          hint="Start each question with Q: and each answer with A:. Leave a blank line between pairs."
          placeholder={"Q: Who can apply?\nA: Any graduate under 30.\n\nQ: Is there negative marking?\nA: Yes, 0.25 marks."} />
      </Sec>

      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-end gap-2.5 border-t border-[var(--line)] bg-white/90 px-[clamp(20px,3.2vw,56px)] py-3.5 backdrop-blur-md min-[900px]:left-[250px]">
        {err ? (
          <span role="alert" className="mr-auto text-[13px] font-semibold text-red-600">{err}</span>
        ) : notice ? (
          <span role="status" className="mr-auto text-[13px] font-semibold text-[var(--ok)]">✓ {notice}</span>
        ) : (
          <span className="mr-auto text-[13px] text-[var(--mute)]">Changes save to jobs.json.</span>
        )}
        {editing && <button type="button" onClick={onCancel} className={btn}>Cancel edit</button>}
        <button type="submit" disabled={saving} className={`${btn} ${btnP} disabled:opacity-70`}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add job"}
        </button>
      </div>
    </form>
  );
}

export default function AdminAddJob() {
  const { id } = useParams(); // present on /admin/edit/:id
  const { jobs, addJob, updateJob } = useAdmin();
  const navigate = useNavigate();
  const [round, setRound] = useState(0); // bumping this resets the blank form after an add
  const [notice, setNotice] = useState("");

  const job = id ? jobs.find((j) => j.id === id) : null;

  if (id && !job) {
    return (
      <div className="py-24 text-center text-[var(--mute)]">
        <b className="block text-[var(--ink)]">Job not found</b>
        <p className="mb-4 mt-1">It may have been deleted.</p>
        <Link to="/admin/jobs" className={`${btn} ${btnP}`}>Back to jobs</Link>
      </div>
    );
  }

  const onSubmit = async (v) => {
    if (job) {
      await updateJob(job.id, v);
      navigate("/admin/jobs");
    } else {
      await addJob(v);
      setNotice(`Added "${v.role}" at ${v.company}. It is live on the website.`);
      setRound((n) => n + 1);
    }
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="m-0 text-[28px] leading-tight tracking-[-.025em]">{job ? "Edit job" : "Add a job"}</h1>
        <p className="mb-0 mt-1 text-[var(--mute)]">
          {job ? `${job.company} – ${job.role}` : "Fill in the details. The job goes live on the website when you save."}
        </p>
      </div>
      <JobForm
        key={id || `new-${round}`}
        initial={job ? { ...EMPTY, ...job } : { ...EMPTY, posted: todayStr() }}
        editing={!!job}
        onSubmit={onSubmit}
        onCancel={() => navigate("/admin/jobs")}
        notice={job ? "" : notice}
      />
    </>
  );
}