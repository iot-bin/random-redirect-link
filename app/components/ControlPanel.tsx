'use client';
import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { controlCopy } from '@/lib/control-copy';
import { DropdownSelect } from './DropdownSelect';
interface Target { id:string;name:string;redirectBaseUrl:string;apiId:string;stage:string;enabled:boolean }
interface Config {version:number;targets:Target[];site:{title:string;description:string};defaultTargetId:string;allowedApiIds:string[]}
interface Member {sub:string;email?:string;role:string;active:boolean;grants:Record<string,string>;version:number}
export function ControlPanel({onChange,currentSub}:{onChange:()=>void;currentSub:string}) {
  const {locale}=useLocale();const c=controlCopy[locale];
  const [section,setSection]=useState<'config'|'members'|'audit'>('config');
  const [config,setConfig]=useState<Config|null>(null);
  const [members,setMembers]=useState<Member[]>([]);const [owner,setOwner]=useState('');
  const [audit,setAudit]=useState<Array<{id:string;at:string;actor:string;operation:string;targetId?:string;status?:number;phase:string}>>([]);
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
  const inputClass='control-input';
  return <section className="panel control-panel"><div className="control-heading"><h2>{c.title}</h2><button className="button" disabled={busy} onClick={()=>void load()}>{c.reload}</button></div>
    <div className="control-navigation" role="group" aria-label={c.title}>{(['config','members','audit'] as const).map(key=><button type="button" key={key} aria-pressed={section===key} onClick={()=>setSection(key)}>{c[key]}</button>)}</div>
    <p role="status">{message}</p>
    {config ? <form hidden={section!=='config'} onInvalidCapture={e=>{const details=(e.target as HTMLElement).closest('details');if(details)details.open=true;}} onSubmit={e=>{e.preventDefault();void save('config',config);}}>
      <p>{c.configHelp}</p><div className="control-fields">
      <label>{c.siteTitle}<input className={inputClass} maxLength={100} value={config.site.title} onChange={e=>setConfig({...config,site:{...config.site,title:e.target.value}})}/></label>
      <label>{c.description}<input className={inputClass} maxLength={500} value={config.site.description} onChange={e=>setConfig({...config,site:{...config.site,description:e.target.value}})}/></label>
      </div>{config.targets.map((target,i)=><details key={i} className="control-disclosure"><summary><span>{target.name || c.add}</span><span className="control-badge">{target.enabled?c.enabled:c.inactive}</span></summary><fieldset disabled={busy} className="control-card">
        {(['id','name','redirectBaseUrl','apiId','stage'] as const).map(key=><div className="control-field" key={key}><span>{({id:'ID',name:c.name,redirectBaseUrl:c.domain,apiId:c.api,stage:c.stage})[key]}</span>
          {key==='apiId'?<DropdownSelect ariaLabel={c.api} disabled={busy} value={target[key]} options={[{value:'',label:'—'},...config.allowedApiIds.map(id=>({value:id,label:id}))]} onChange={value=>setConfig({...config,targets:config.targets.map((t,n)=>n===i?{...t,[key]:value}:t)})}/>
          :<input aria-label={({id:'ID',name:c.name,redirectBaseUrl:c.domain,apiId:c.api,stage:c.stage})[key]} className={inputClass} required value={target[key]} onChange={e=>setConfig({...config,targets:config.targets.map((t,n)=>n===i?{...t,[key]:e.target.value}:t)})}/>}</div>)}
        <label className="control-checkbox"><input type="checkbox" checked={target.enabled} onChange={e=>setConfig({...config,targets:config.targets.map((t,n)=>n===i?{...t,enabled:e.target.checked}:t)})}/>{c.enabled}</label>
        <div className="control-actions"><button type="button" className="button" onClick={()=>setConfig({...config,targets:config.targets.filter((_,n)=>n!==i),defaultTargetId:config.defaultTargetId===target.id?'':config.defaultTargetId})}>{c.remove}</button></div>
      </fieldset></details>)}
      <div className="control-actions"><button type="button" className="button" disabled={busy||config.targets.length>=50} onClick={()=>setConfig({...config,targets:[...config.targets,{id:'',name:'',redirectBaseUrl:'',apiId:'',stage:'$default',enabled:true}]})}>{c.add}</button></div>
      <div className="control-field control-default"><span>{c.defaultTarget}</span><DropdownSelect ariaLabel={c.defaultTarget} disabled={busy} value={config.defaultTargetId} options={[{value:'',label:'—'},...config.targets.filter(t=>t.enabled).map(t=>({value:t.id,label:t.name}))]} onChange={value=>setConfig({...config,defaultTargetId:value})}/></div>
      <div className="control-actions"><button className="button button-primary" disabled={busy}>{c.save}</button></div>
    </form>:null}
    <div hidden={section!=='members'} className="control-section"><p>{c.inviteHelp}</p>
    <form className="control-invite" onSubmit={e=>{e.preventDefault();void save('members',{email},'POST');}}><label>{c.email}<input className={inputClass} type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><button className="button" disabled={busy}>{c.invite}</button></form>
    {members.map((member,i)=><details key={member.sub} className="control-disclosure"><summary><span>{member.email||member.sub}</span><span className="control-badge">{member.sub===owner?c.owner:member.role==='admin'?c.admin:c.member}</span></summary><fieldset disabled={busy||member.sub===owner||member.sub===currentSub} className="control-card">
      <div className="control-field"><span>{c.role}</span><DropdownSelect ariaLabel={c.role} disabled={busy||member.sub===owner||member.sub===currentSub} value={member.role} options={[{value:'member',label:c.member},{value:'admin',label:c.admin}]} onChange={value=>setMembers(members.map((m,n)=>n===i?{...m,role:value}:m))}/></div>
      <label className="control-checkbox"><input type="checkbox" checked={member.active} onChange={e=>setMembers(members.map((m,n)=>n===i?{...m,active:e.target.checked}:m))}/>{c.active}</label>
      {member.role!=='admin'?config?.targets.map(t=><div className="control-field" key={t.id}><span>{t.name}</span><DropdownSelect ariaLabel={t.name} disabled={busy||member.sub===owner||member.sub===currentSub} value={member.grants[t.id]??''} options={[{value:'',label:c.none},{value:'viewer',label:c.viewer},{value:'editor',label:c.editor}]} onChange={value=>{
        const grants={...member.grants};if(value)grants[t.id]=value;else delete grants[t.id];
        setMembers(members.map((m,n)=>n===i?{...m,grants}:m));
      }}/></div>):null}
      <div className="control-actions"><button className="button button-primary" onClick={()=>void save('members',member)}>{c.save}</button></div>
    </fieldset></details>)}</div>
    <div hidden={section!=='audit'} className="control-audit">{audit.map((a,i)=><p key={a.id+':'+i}><time>{new Date(a.at).toLocaleString(locale)}</time> · {a.actor} · {a.operation} · {a.targetId} · {a.phase} {a.status}</p>)}</div>
  </section>;
}
