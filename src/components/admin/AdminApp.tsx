'use client';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Notice, Sheet, btnPrimary, btnSecondary } from '@/components/guest/ui';
import { errText, fmtDateTime, inputCls } from '@/components/dash/api';
import { ApiFailure } from '@/lib/guest/client';

interface Row { id: string; slug: string; name: string; status: 'active' | 'suspended'; plan: string; paid_until: string | null; created_at: string; last_order_at: string | null; order_count: number }
interface StaffRow { user_id: string; role: string; display_name: string; active: boolean; email: string | null }
interface AuditEntry { id: number; created_at: string; action: string; entity: string; actor_role: string | null; details: Record<string, unknown> | null }
const smallBtn = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-900 hover:bg-stone-100 disabled:opacity-50';

async function adminPost<T>(action: string, data: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/admin/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(data) });
  } catch {
    throw new ApiFailure('network', 0);
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: { key?: string } }) | null;
  if (!res.ok) throw new ApiFailure(body?.error?.key ?? 'server_error', res.status);
  return body as T;
}
async function adminGet<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/admin/${path}`, { credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ApiFailure('network', 0);
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: { key?: string } }) | null;
  if (!res.ok) throw new ApiFailure(body?.error?.key ?? 'server_error', res.status);
  return body as T;
}
const toIso = (local: string) => (local ? new Date(`${local}T23:59:59+05:30`).toISOString() : null);
const toLocalDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '');

export function AdminApp() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [plan, setPlan] = useState<Row | null>(null);
  const [audit, setAudit] = useState<{ row: Row; entries: AuditEntry[] | null } | null>(null);
  const [logins, setLogins] = useState<{ row: Row; staff: StaffRow[] | null } | null>(null);
  const [mailFor, setMailFor] = useState<StaffRow | null>(null);
  const [newMail, setNewMail] = useState('');
  const [adding, setAdding] = useState(false);
  const [af, setAf] = useState({ name: '', email: '', role: 'manager' });
  const [del, setDel] = useState<Row | null>(null);
  const [typed, setTyped] = useState('');
  const [secret, setSecret] = useState<{ email: string; slug: string; password: string; title?: string } | null>(null);
  const [f, setF] = useState({ slug: '', name: '', owner_email: '', owner_name: '', plan: 'pilot', paid: '' });
  const [pf, setPf] = useState({ plan: '', paid: '' });

  const load = async () => {
    try {
      const r = await fetch('/api/admin/restaurants', { credentials: 'same-origin', cache: 'no-store' });
      const b = (await r.json().catch(() => null)) as { restaurants?: Row[]; error?: { key?: string } } | null;
      if (r.status === 401) return window.location.assign('/login?next=/admin');
      if (r.status === 403 && b?.error?.key === 'mfa_required') return window.location.assign('/account/mfa?next=/admin');
      if (!r.ok) throw new ApiFailure(b?.error?.key ?? 'server_error', r.status);
      setRows(b?.restaurants ?? []);
      setError(null);
    } catch (e) {
      setError(errText(e));
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const run = async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | null> => {
    setBusy(true); setErr(null); setMsg(null);
    try { const r = await fn(); if (ok) setMsg(ok); await load(); return r; } catch (e) { setErr(errText(e)); return null; } finally { setBusy(false); }
  };

  const loadLogins = async (r: Row) => {
    const x = await adminGet<{ staff: StaffRow[] }>(`staff?id=${r.id}`);
    setLogins({ row: r, staff: x.staff });
  };

  const shown = useMemo(() => (rows ?? []).filter((r) => `${r.name} ${r.slug}`.toLowerCase().includes(q.trim().toLowerCase())), [rows, q]);
  const overdue = (r: Row) => r.paid_until !== null && new Date(r.paid_until) < new Date();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-extrabold">Restaurants</h1>
        <button type="button" className={btnPrimary} onClick={() => { setErr(null); setF({ slug: '', name: '', owner_email: '', owner_name: '', plan: 'pilot', paid: '' }); setCreating(true); }}>Create restaurant</button>
      </div>
      <label className="mt-3 block text-sm font-semibold">Search
        <input value={q} onChange={(e) => setQ(e.target.value)} className={inputCls} />
      </label>
      <div className="mt-3 space-y-2" aria-live="polite">{error && <Alert>{error}</Alert>}{err && !creating && !plan && !del && <Alert>{err}</Alert>}{msg && <Notice>{msg}</Notice>}</div>
      {!rows && !error && <p className="mt-6 text-stone-700">Loading…</p>}
      <ul className="mt-4 space-y-3">
        {shown.map((r) => (
          <li key={r.id} className="rounded-2xl border border-stone-200 bg-white p-4" data-testid={`restaurant-${r.slug}`}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto text-lg font-bold">{r.name} <span className="font-mono text-sm font-normal text-stone-700">/{r.slug}</span></p>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${r.status === 'active' ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>{r.status === 'active' ? 'Active' : 'Suspended'}</span>
            </div>
            <p className="mt-1 text-sm text-stone-800">
              Plan: <strong>{r.plan}</strong> · Paid until: {r.paid_until ? fmtDateTime(r.paid_until) : 'no end date'}{overdue(r) && <strong className="text-red-800"> (overdue)</strong>}
              {' · '}Last order: {r.last_order_at ? fmtDateTime(r.last_order_at) : 'none yet'} · Orders: {r.order_count}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={smallBtn} disabled={busy} onClick={() => void run(() => adminPost('set-status', { id: r.id, status: r.status === 'active' ? 'suspended' : 'active' }), r.status === 'active' ? `${r.name} is suspended: guests cannot order and staff cannot make changes.` : `${r.name} is active again.`)}>{r.status === 'active' ? `Suspend ${r.name}` : `Activate ${r.name}`}</button>
              <button type="button" className={smallBtn} onClick={() => { setErr(null); setPlan(r); setPf({ plan: r.plan, paid: toLocalDate(r.paid_until) }); }} aria-label={`Plan and payment for ${r.name}`}>Plan &amp; payment</button>
              <button type="button" className={smallBtn} onClick={async () => { setAudit({ row: r, entries: null }); try { const x = await adminGet<{ entries: AuditEntry[] }>(`audit?id=${r.id}`); setAudit({ row: r, entries: x.entries }); } catch (e) { setAudit(null); setErr(errText(e)); } }} aria-label={`Activity log for ${r.name}`}>Activity log</button>
              <button type="button" className={smallBtn} onClick={async () => { setErr(null); setMailFor(null); setLogins({ row: r, staff: null }); try { await loadLogins(r); } catch (e) { setLogins(null); setErr(errText(e)); } }} aria-label={`Logins of ${r.name}`}>Logins</button>
              <a className={smallBtn} href={`/api/admin/export?id=${r.id}`} download aria-label={`Export data of ${r.name}`}>Export data</a>
              <button type="button" className={smallBtn} onClick={() => { setErr(null); setDel(r); setTyped(''); }} aria-label={`Delete ${r.name}`}>Delete…</button>
            </div>
          </li>
        ))}
      </ul>
      {rows && shown.length === 0 && <p className="mt-6 text-stone-800">No restaurants found.</p>}

      <Sheet open={creating} onClose={() => setCreating(false)} title="Create restaurant" closeLabel="Close">
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault();
          const r = await run(() => adminPost<{ owner_email: string; slug: string; temporary_password: string }>('create-restaurant', { slug: f.slug, name: f.name, owner_email: f.owner_email, owner_name: f.owner_name, plan: f.plan, paid_until: toIso(f.paid) }));
          if (r) { setCreating(false); setSecret({ email: r.owner_email, slug: r.slug, password: r.temporary_password }); }
        }}>
          <label className="block text-sm font-semibold">Restaurant name<input required maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} /></label>
          <label className="block text-sm font-semibold">Web address (after the domain)<input required value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })} className={inputCls} /><span className="text-sm font-normal text-stone-700">Lowercase letters, numbers and hyphens, for example spice-garden</span></label>
          <label className="block text-sm font-semibold">Owner name<input required maxLength={60} value={f.owner_name} onChange={(e) => setF({ ...f, owner_name: e.target.value })} className={inputCls} /></label>
          <label className="block text-sm font-semibold">Owner email<input type="email" required inputMode="email" value={f.owner_email} onChange={(e) => setF({ ...f, owner_email: e.target.value })} className={inputCls} /></label>
          <label className="block text-sm font-semibold">Plan<input required maxLength={30} value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })} className={inputCls} /></label>
          <label className="block text-sm font-semibold">Paid until (optional)<input type="date" value={f.paid} onChange={(e) => setF({ ...f, paid: e.target.value })} className={inputCls} /></label>
          {err && <Alert>{err}</Alert>}
          <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>Create restaurant and owner login</button>
        </form>
      </Sheet>

      <Sheet open={!!secret} onClose={() => setSecret(null)} title={secret?.title ?? 'Restaurant created'} closeLabel="Close">
        <div className="space-y-3">
          <p className="text-stone-800">Give these details to {secret?.email}. They sign in with this email and temporary password, then choose their own password. <strong>This password is shown only once.</strong></p>
          <p className="break-all rounded-xl bg-stone-100 p-3 font-mono text-lg" data-testid="temp-password">{secret?.password}</p>
          <button type="button" className={`${btnPrimary} w-full`} onClick={() => setSecret(null)}>I have saved it</button>
        </div>
      </Sheet>

      <Sheet open={!!logins} onClose={() => { setLogins(null); setMailFor(null); setAdding(false); }} title={`Logins: ${logins?.row.name ?? ''}`} closeLabel="Close">
        {logins?.staff && (
          <div className="mb-3">
            {!adding ? (
              <button type="button" className={`${btnPrimary} w-full`} onClick={() => { setErr(null); setAf({ name: '', email: '', role: logins.staff!.some((x) => x.role === 'owner') ? 'manager' : 'owner' }); setAdding(true); }}>Add login</button>
            ) : (
              <form className="space-y-3 rounded-xl border border-stone-200 p-3" onSubmit={async (e) => {
                e.preventDefault();
                const r = await run(() => adminPost<{ email: string; temporary_password: string }>('staff-add', { id: logins.row.id, email: af.email, name: af.name, role: af.role }));
                if (r) { setAdding(false); setLogins(null); setSecret({ email: r.email, slug: logins.row.slug, password: r.temporary_password, title: 'Login created' }); }
              }}>
                <label className="block text-sm font-semibold">Name<input required maxLength={60} value={af.name} onChange={(e) => setAf({ ...af, name: e.target.value })} className={inputCls} /></label>
                <label className="block text-sm font-semibold">Email<input type="email" required inputMode="email" value={af.email} onChange={(e) => setAf({ ...af, email: e.target.value })} className={inputCls} /></label>
                <label className="block text-sm font-semibold">Role
                  <select value={af.role} onChange={(e) => setAf({ ...af, role: e.target.value })} className={inputCls}>
                    <option value="owner">Owner</option><option value="manager">Manager</option><option value="waiter">Waiter</option><option value="kitchen">Kitchen</option>
                  </select>
                </label>
                {err && <Alert>{err}</Alert>}
                <div className="flex gap-2">
                  <button type="button" className={`${btnSecondary} flex-1`} onClick={() => setAdding(false)}>Cancel</button>
                  <button type="submit" disabled={busy} className={`${btnPrimary} flex-1`}>Create login</button>
                </div>
              </form>
            )}
          </div>
        )}
        {!logins?.staff ? <p>Loading…</p> : logins.staff.length === 0 ? <p>No logins for this restaurant.</p> : (
          <ul className="space-y-3">
            {logins.staff.map((m) => (
              <li key={m.user_id} className="rounded-xl border border-stone-200 p-3 text-sm" data-testid={`login-${m.role}`}>
                <p className="font-semibold">{m.display_name} · {m.role}{m.active ? '' : ' (switched off)'}</p>
                <p className="break-all text-stone-800">{m.email ?? 'no email'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={smallBtn} disabled={busy} aria-label={`Reset password of ${m.display_name}`} onClick={async () => {
                    const r = await run(() => adminPost<{ temporary_password: string }>('staff-reset-password', { id: logins.row.id, user_id: m.user_id }));
                    if (r) { setLogins(null); setSecret({ email: m.email ?? m.display_name, slug: logins.row.slug, password: r.temporary_password, title: 'New temporary password' }); }
                  }}>Reset password</button>
                  <button type="button" className={smallBtn} disabled={busy} aria-label={`Change email of ${m.display_name}`} onClick={() => { setErr(null); setMailFor(m); setNewMail(m.email ?? ''); }}>Change email</button>
                </div>
                {mailFor?.user_id === m.user_id && (
                  <form className="mt-3 space-y-2" onSubmit={async (e) => {
                    e.preventDefault();
                    const r = await run(() => adminPost('staff-change-email', { id: logins.row.id, user_id: m.user_id, email: newMail }), 'Email changed. The old email no longer works.');
                    if (r) { setMailFor(null); await loadLogins(logins.row); }
                  }}>
                    <label className="block text-sm font-semibold">New email<input type="email" required inputMode="email" value={newMail} onChange={(e) => setNewMail(e.target.value)} className={inputCls} /></label>
                    {err && <Alert>{err}</Alert>}
                    <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>Save email</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      <Sheet open={!!plan} onClose={() => setPlan(null)} title={`Plan & payment: ${plan?.name ?? ''}`} closeLabel="Close">
        <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (!plan) return; const r = await run(() => adminPost('set-plan', { id: plan.id, plan: pf.plan, paid_until: toIso(pf.paid) }), 'Plan saved.'); if (r) setPlan(null); }}>
          <label className="block text-sm font-semibold">Plan<input required maxLength={30} value={pf.plan} onChange={(e) => setPf({ ...pf, plan: e.target.value })} className={inputCls} /></label>
          <label className="block text-sm font-semibold">Paid until (leave empty for no end date)<input type="date" value={pf.paid} onChange={(e) => setPf({ ...pf, paid: e.target.value })} className={inputCls} /></label>
          {err && <Alert>{err}</Alert>}
          <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>Save</button>
        </form>
      </Sheet>

      <Sheet open={!!audit} onClose={() => setAudit(null)} title={`Activity log: ${audit?.row.name ?? ''}`} closeLabel="Close">
        {!audit?.entries ? <p>Loading…</p> : audit.entries.length === 0 ? <p>Nothing recorded yet.</p> : (
          <ul className="space-y-2">
            {audit.entries.map((a) => (
              <li key={a.id} className="rounded-xl border border-stone-200 p-3 text-sm">
                <p className="font-semibold">{a.action.replace(/_/g, ' ')} · {a.entity}</p>
                <p className="text-stone-700">{fmtDateTime(a.created_at)} · {a.actor_role?.replace('_', ' ') ?? 'system'}</p>
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      <Sheet open={!!del} onClose={() => setDel(null)} title={`Delete ${del?.name ?? ''}?`} closeLabel="Close">
        <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (!del) return; const r = await run(() => adminPost('delete-restaurant', { id: del.id, confirm_slug: typed }), `${del.name} and all its data were deleted.`); if (r) setDel(null); }}>
          <p className="text-stone-800">This <strong>permanently deletes</strong> the restaurant, its menu, orders, photos and staff logins. It cannot be undone. Consider exporting the data first.</p>
          <label className="block text-sm font-semibold">Type <span className="font-mono">{del?.slug}</span> to confirm
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className={inputCls} />
          </label>
          {err && <Alert>{err}</Alert>}
          <div className="flex gap-2">
            <button type="button" className={`${btnSecondary} flex-1`} onClick={() => setDel(null)}>Cancel</button>
            <button type="submit" disabled={busy || typed !== del?.slug} className={`${btnPrimary} flex-1`}>Delete forever</button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
