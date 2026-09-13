'use client';
import { useEffect, useState } from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { controlCopy } from '@/lib/control-copy';

export function MfaPanel() {
  const { locale } = useLocale();
  const c = controlCopy[locale];
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/mfa', { cache: 'no-store', signal: controller.signal })
      .then(async r => {
        if (!r.ok) throw new Error();
        const data = await r.json();
        if (!controller.signal.aborted) { setEnabled(data.enabled); setFailed(false); }
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [revision]);

  async function submit(action: string) {
    setBusy(true); setFailed(false);
    try {
      const r = await fetch('/api/auth/mfa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, code }) });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setSecret(data.secret ?? ''); setCode('');
      if (data.enabled) { setEnabled(true); setRevision(v => v + 1); }
    } catch { setFailed(true); } finally { setBusy(false); }
  }

  return <section className="panel control-panel mfa-panel">
    <div className="control-heading">
      <div><h2>{c.mfa}</h2><p>{enabled ? c.mfaEnabledHelp : c.mfaDescription}</p></div>
      {enabled !== null ? <span className={'control-badge' + (enabled ? ' is-enabled' : '')}>{enabled ? c.mfaEnabled : c.mfaDisabled}</span> : null}
    </div>
    {failed ? <div className="control-actions"><p role="alert">{c.failed}</p><button className="button" onClick={() => setRevision(v => v + 1)}>{c.reload}</button></div> : null}
    {enabled === null && !failed ? <p role="status">{c.loading}</p> : null}
    {enabled === false && (secret ? <form className="mfa-enrollment" onSubmit={e => { e.preventDefault(); void submit('verify'); }}>
      <p>{c.mfaHelp}</p><code>{secret}</code>
      <label>{c.code}<input className="control-input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} required pattern="[0-9]{6}" maxLength={6} /></label>
      <div className="control-actions"><button className="button button-primary" disabled={busy}>{c.verify}</button></div>
    </form> : <div className="control-actions"><button className="button" disabled={busy} onClick={() => void submit('setup')}>{c.setup}</button></div>)}
  </section>;
}
