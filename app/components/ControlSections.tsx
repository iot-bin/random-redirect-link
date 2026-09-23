import type { Dispatch, SetStateAction } from 'react';
import { controlCopy } from '@/lib/control-copy';
import { DropdownSelect } from './DropdownSelect';

export interface ControlTarget { id: string; name: string; redirectBaseUrl: string; apiId: string; stage: string; enabled: boolean }
export interface ControlConfig { version: number; targets: ControlTarget[]; site: { title: string; description: string }; defaultTargetId: string; allowedApiIds: string[] }
export interface ControlMember { sub: string; email?: string; role: string; active: boolean; grants: Record<string, string>; version: number }
export interface ControlAuditEntry { id: string; at: string; actor: string; operation: string; targetId?: string; status?: number; phase: string }

type Copy = (typeof controlCopy)[keyof typeof controlCopy];

export function ControlMembersSection({ c, hidden, busy, email, setEmail, members, setMembers, owner, currentSub, config, save }: {
  c: Copy; hidden: boolean; busy: boolean; email: string; setEmail: (value: string) => void;
  members: ControlMember[]; setMembers: Dispatch<SetStateAction<ControlMember[]>>;
  owner: string; currentSub: string; config: ControlConfig | null;
  save: (path: string, body: unknown, method?: string) => Promise<void>;
}) {
  return <div hidden={hidden} className="control-section"><p>{c.inviteHelp}</p>
    <form className="control-invite" onSubmit={e => { e.preventDefault(); void save('members', { email }, 'POST'); }}>
      <label>{c.email}<input className="control-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <button className="button" disabled={busy}>{c.invite}</button>
    </form>
    {members.map((member, i) => <details key={member.sub} className="control-disclosure"><summary><span>{member.email || member.sub}</span><span className="control-badge">{member.sub === owner ? c.owner : member.role === 'admin' ? c.admin : c.member}</span></summary><fieldset disabled={busy || member.sub === owner || member.sub === currentSub} className="control-card">
      <div className="control-field"><span>{c.role}</span><DropdownSelect ariaLabel={c.role} disabled={busy || member.sub === owner || member.sub === currentSub} value={member.role} options={[{ value: 'member', label: c.member }, { value: 'admin', label: c.admin }]} onChange={value => setMembers(members.map((m, n) => n === i ? { ...m, role: value } : m))} /></div>
      <label className="control-checkbox"><input type="checkbox" checked={member.active} onChange={e => setMembers(members.map((m, n) => n === i ? { ...m, active: e.target.checked } : m))} />{c.active}</label>
      {member.role !== 'admin' ? config?.targets.map(t => <div className="control-field" key={t.id}><span>{t.name}</span><DropdownSelect ariaLabel={t.name} disabled={busy || member.sub === owner || member.sub === currentSub} value={member.grants[t.id] ?? ''} options={[{ value: '', label: c.none }, { value: 'viewer', label: c.viewer }, { value: 'editor', label: c.editor }]} onChange={value => {
        const grants = { ...member.grants }; if (value) grants[t.id] = value; else delete grants[t.id];
        setMembers(members.map((m, n) => n === i ? { ...m, grants } : m));
      }} /></div>) : null}
      <div className="control-actions"><button className="button button-primary" onClick={() => void save('members', member)}>{c.save}</button></div>
    </fieldset></details>)}
  </div>;
}

export function ControlAuditSection({ hidden, entries, locale }: { hidden: boolean; entries: ControlAuditEntry[]; locale: string }) {
  return <div hidden={hidden} className="control-audit">{entries.map((entry, i) => <p key={entry.id + ':' + i}><time>{new Date(entry.at).toLocaleString(locale)}</time> · {entry.actor} · {entry.operation} · {entry.targetId} · {entry.phase} {entry.status}</p>)}</div>;
}
