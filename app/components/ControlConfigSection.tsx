import type { Dispatch, SetStateAction } from 'react';
import { controlCopy } from '@/lib/control-copy';
import { DropdownSelect } from './DropdownSelect';
import type { ControlConfig } from './ControlSections';

type Copy = (typeof controlCopy)[keyof typeof controlCopy];

export function ControlConfigSection({ c, config, setConfig, setMessage, busy, hidden, save }: {
  c: Copy; config: ControlConfig | null; setConfig: Dispatch<SetStateAction<ControlConfig | null>>;
  setMessage: Dispatch<SetStateAction<string>>; busy: boolean; hidden: boolean;
  save: (path: string, body: unknown, method?: string) => Promise<void>;
}) {
  const inputClass = 'control-input';
  return <>
    {config ? <form hidden={hidden} onInvalidCapture={e=>{const details=(e.target as HTMLElement).closest('details');if(details)details.open=true;}} onSubmit={e=>{e.preventDefault();if(config.targets.some(t=>!config.allowedApiIds.includes(t.apiId))){setMessage(c.selectApi);return;}void save('config',config);}}>
      <p>{config.allowedApiIds.length ? c.configHelp : c.noApis}</p><div className="control-fields">
      <label>{c.siteTitle}<input className={inputClass} maxLength={100} value={config.site.title} onChange={e=>setConfig({...config,site:{...config.site,title:e.target.value}})}/></label>
      <label>{c.description}<input className={inputClass} maxLength={500} value={config.site.description} onChange={e=>setConfig({...config,site:{...config.site,description:e.target.value}})}/></label>
      </div>{config.targets.map((target,i)=><details key={i} className="control-disclosure"><summary><span>{target.name || c.add}</span><span className="control-badge">{target.enabled?c.enabled:c.inactive}</span></summary><fieldset disabled={busy} className="control-card">
        {(['id','name','redirectBaseUrl','apiId','stage'] as const).map(key=><div className="control-field" key={key}><span>{({id:'ID',name:c.name,redirectBaseUrl:c.domain,apiId:c.api,stage:c.stage})[key]}</span>
          {key==='apiId'?<DropdownSelect ariaLabel={c.api} placeholder={config.allowedApiIds.length ? c.selectApi : c.noApis} disabled={busy || !config.allowedApiIds.length} value={target[key]} options={config.allowedApiIds.map(id=>{const names=config.targets.filter(t=>t.apiId===id && t.name.trim()).map(t=>t.name);return {value:id,label:names.length ? `${[...new Set(names)].join(' / ')} · ${id}` : id};})} onChange={value=>setConfig({...config,targets:config.targets.map((t,n)=>n===i?{...t,[key]:value}:t)})}/>
          :<input aria-label={({id:'ID',name:c.name,redirectBaseUrl:c.domain,apiId:c.api,stage:c.stage})[key]} className={inputClass} required value={target[key]} onChange={e=>setConfig({...config,targets:config.targets.map((t,n)=>n===i?{...t,[key]:e.target.value}:t)})}/>}</div>)}
        <label className="control-checkbox"><input type="checkbox" checked={target.enabled} onChange={e=>setConfig({...config,targets:config.targets.map((t,n)=>n===i?{...t,enabled:e.target.checked}:t)})}/>{c.enabled}</label>
        <div className="control-actions"><button type="button" className="button" onClick={()=>setConfig({...config,targets:config.targets.filter((_,n)=>n!==i),defaultTargetId:config.defaultTargetId===target.id?'':config.defaultTargetId})}>{c.remove}</button></div>
      </fieldset></details>)}
      <div className="control-actions"><button type="button" className="button" disabled={busy||config.targets.length>=50} onClick={()=>setConfig({...config,targets:[...config.targets,{id:'',name:'',redirectBaseUrl:'',apiId:'',stage:'$default',enabled:true}]})}>{c.add}</button></div>
      <div className="control-field control-default"><span>{c.defaultTarget}</span><DropdownSelect ariaLabel={c.defaultTarget} placeholder={c.selectDefault} disabled={busy} value={config.defaultTargetId} options={config.targets.filter(t=>t.enabled).map(t=>({value:t.id,label:t.name}))} onChange={value=>setConfig({...config,defaultTargetId:value})}/></div>
      <div className="control-actions"><button className="button button-primary" disabled={busy}>{c.save}</button></div>
    </form>:null}  </>;
}
