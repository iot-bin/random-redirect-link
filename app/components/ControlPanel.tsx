'use client';
import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { controlCopy } from '@/lib/control-copy';
import { ControlConfigSection } from './ControlConfigSection';
import { ControlAuditSection, ControlMembersSection } from './ControlSections';
import type { ControlAuditEntry, ControlConfig, ControlMember } from './ControlSections';
export function ControlPanel({onChange,currentSub}:{onChange:()=>void;currentSub:string}) {
  const {locale}=useLocale();const c=controlCopy[locale];
  const [section,setSection]=useState<'config'|'members'|'audit'>('config');
  const [config,setConfig]=useState<ControlConfig|null>(null);
  const [members,setMembers]=useState<ControlMember[]>([]);const [owner,setOwner]=useState('');
  const [audit,setAudit]=useState<ControlAuditEntry[]>([]);
  const [email,setEmail]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{
    try {
      const responses=await Promise.all(['config','members','audit'].map(p=>fetch('/api/control/'+p,{cache:'no-store'})));
      if(responses.some(r=>!r.ok)) throw new Error();
      const [cfg,users,log]=await Promise.all(responses.map(r=>r.json()));
      setConfig(cfg);setMembers(users.members);setOwner(users.ownerSub);setAudit(log.entries);
    }catch{setMessage(c.failed);}
  },[c.failed]);
  useEffect(()=>{void load();},[load]);
  async function save(path:string,body:unknown,method='PUT') {
    setBusy(true);setMessage('');
    try {
      const r=await fetch('/api/control/'+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(!r.ok) throw new Error();
      setMessage(c.saved);await load();onChange();
    }catch{setMessage(c.failed);}finally{setBusy(false);}
  }
  return <section className="panel control-panel"><div className="control-heading"><h2>{c.title}</h2><button className="button" disabled={busy} onClick={()=>void load()}>{c.reload}</button></div>
    <div className="control-navigation" role="group" aria-label={c.title}>{(['config','members','audit'] as const).map(key=><button type="button" key={key} aria-pressed={section===key} onClick={()=>setSection(key)}>{c[key]}</button>)}</div>
    <p role="status">{message}</p>
    <ControlConfigSection c={c} config={config} setConfig={setConfig} setMessage={setMessage} busy={busy} hidden={section!=='config'} save={save} />
    <ControlMembersSection c={c} hidden={section!=='members'} busy={busy} email={email} setEmail={setEmail} members={members} setMembers={setMembers} owner={owner} currentSub={currentSub} config={config} save={save} />
    <ControlAuditSection hidden={section!=='audit'} entries={audit} locale={locale} />
  </section>;
}
