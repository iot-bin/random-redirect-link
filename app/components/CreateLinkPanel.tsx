'use client';

import { useMemo, useRef, useState } from 'react';
import { ScheduleFields, LifecycleBadge, LifecycleDates } from './LinkLifecycle';
import { scheduleInput } from '@/lib/link-lifecycle';
import { QRCodeSVG } from 'qrcode.react';
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  LinkIcon,
  SearchIcon,
} from '@/app/components/Icons';
import {
  buildShortUrl,
  getLinkPathError,
  getLinkTarget,
  normalizeLinkPath,
} from '@/lib/link-path';
import type {
  LinkRecord,
  PublicApiTarget,
} from '@/lib/link-types';
import {
  getSubdomainLengthError,
  getTargetUrlError,
} from '@/lib/link-validation';
import {
  translateApiError,
  translateValidationError,
} from '@/lib/i18n/errors';
import { useLocale } from '@/lib/i18n/LocaleProvider';

interface CreateLinkPanelProps {
  target: PublicApiTarget | null;
  onManage: (path: string) => void;
}

export function CreateLinkPanel({
  target,
  onManage,
}: CreateLinkPanelProps) {
  const { t } = useLocale();
  const [path, setPath] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [randomSubdomain, setRandomSubdomain] = useState(true);
  const [subdomainLength, setSubdomainLength] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<LinkRecord | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<SVGSVGElement>(null);

  const normalizedPath = useMemo(() => normalizeLinkPath(path), [path]);
  const pathError = useMemo(
    () => translateValidationError(getLinkPathError(path), t),
    [path, t],
  );
  const targetUrlError = useMemo(
    () => translateValidationError(getTargetUrlError(targetUrl.trim()), t),
    [t, targetUrl],
  );
  const lengthError = randomSubdomain
    ? translateValidationError(getSubdomainLengthError(subdomainLength), t)
    : '';

  const previewShortUrl =
    target && normalizedPath
      ? buildShortUrl(target.redirectBaseUrl, normalizedPath)
      : '';
  const resultShortUrl =
    target && result
      ? buildShortUrl(target.redirectBaseUrl, result.path)
      : '';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setResult(null);
    setCopied(false);

    const validationError =
      (!target ? t('common.chooseEnvironment') : '')
      || pathError
      || targetUrlError
      || lengthError;

    if (validationError) {
      setError(validationError);
      return;
    }

    let schedule;
    try { schedule = scheduleInput(startsAt, expiresAt); } catch { setError(t('life.invalid')); return; }
    setSubmitting(true);
    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: target?.id,
          path: normalizedPath,
          ...schedule,
          targetUrl: targetUrl.trim(),
          randomSubdomain,
          ...(randomSubdomain ? { subdomainLength } : {}),
        }),
      });
      const payload: unknown = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(translateApiError(payload, t, 'create.failed'));
        return;
      }

      setResult(payload as LinkRecord);
    } catch {
      setError(t('common.networkError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyShortUrl() {
    if (!resultShortUrl) return;

    try {
      await navigator.clipboard.writeText(resultShortUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setError(t('create.copyFailed'));
    }
  }

  function downloadQrCode() {
    const svg = qrRef.current;
    if (!svg) return;

    const blob = new Blob(
      [new XMLSerializer().serializeToString(svg)],
      { type: 'image/svg+xml' },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${result?.path || 'short-link'}-qrcode.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="create-workspace">
      <section className="panel create-panel" aria-labelledby="create-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t('create.eyebrow')}</p>
            <h2 id="create-title">{t('create.title')}</h2>
            <p>{t('create.description')}</p>
          </div>
        </div>

        <form className="link-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="link-path">{t('create.path')}</label>
            <div className="input-prefix-group">
              <span aria-hidden="true">
                {target?.redirectBaseUrl.replace(/^https?:\/\//, '') || t('common.noEnvironment')}/
              </span>
              <input
                id="link-path"
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder={t('create.pathPlaceholder')}
                autoComplete="off"
                aria-describedby={path && pathError
                  ? 'link-path-help link-path-error'
                  : 'link-path-help'}
                aria-invalid={Boolean(path && pathError)}
              />
            </div>
            <p id="link-path-help" className="field-help">
              {previewShortUrl || t('create.pathHelp')}
            </p>
            {path && pathError ? (
              <p id="link-path-error" className="field-error">{pathError}</p>
            ) : null}
          </div>

          <div className="form-field">
            <label htmlFor="target-url">{t('create.targetUrl')}</label>
            <input
              id="target-url"
              type="url"
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              placeholder={t('create.targetPlaceholder')}
              aria-describedby={targetUrl && targetUrlError
                ? 'target-url-help target-url-error'
                : 'target-url-help'}
              aria-invalid={Boolean(targetUrl && targetUrlError)}
            />
            <p id="target-url-help" className="field-help">
              {t('create.targetHelp')}
            </p>
            {targetUrl && targetUrlError ? (
              <p id="target-url-error" className="field-error">{targetUrlError}</p>
            ) : null}
          </div>

          <fieldset className="mode-fieldset">
            <legend>{t('create.mode')}</legend>
            <label className="toggle-card mode-summary">
              <span>
                <strong>{t('create.randomSubdomain')}</strong>
                <small>
                  {randomSubdomain
                    ? t('create.randomSubdomainHelp')
                    : t('create.fixedModeHelp')}
                </small>
              </span>
              <span className="mode-control">
                <span className={randomSubdomain ? 'mode-status' : 'mode-status mode-status-off'}>
                  {randomSubdomain ? t('create.modeEnabled') : t('create.modeDisabled')}
                </span>
                <input
                  type="checkbox"
                  checked={randomSubdomain}
                  onChange={(event) => setRandomSubdomain(event.target.checked)}
                  aria-label={t('create.randomSubdomain')}
                />
              </span>
            </label>

            {randomSubdomain ? (
              <>
                <div className="inline-field">
                  <label htmlFor="subdomain-length">{t('create.subdomainLength')}</label>
                  <input
                    id="subdomain-length"
                    type="number"
                    min={3}
                    max={32}
                    step={1}
                    value={subdomainLength}
                    onChange={(event) => setSubdomainLength(Number(event.target.value))}
                  />
                  <span>{t('create.characters')}</span>
                </div>

                {lengthError ? (
                  <p className="field-error">{lengthError}</p>
                ) : null}
              </>
            ) : null}
          </fieldset>

          {error ? (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          ) : null}

          <ScheduleFields id="create-schedule" startsAt={startsAt} expiresAt={expiresAt} onStart={setStartsAt} onExpiry={setExpiresAt} disabled={submitting} />
          <div className="form-actions">
            <button
              className="button button-primary"
              type="submit"
              disabled={submitting || !target}
            >
              <LinkIcon />
              {submitting ? t('create.submitting') : t('create.submit')}
            </button>
            <span className="action-hint">{t('create.actionHint')}</span>
          </div>
        </form>
      </section>

      <aside className="panel result-panel" aria-live="polite">
        {result ? (
          <>
            <div className="success-badge">
              <CheckIcon />
              {t('create.success')}
            </div>
            <div className="result-heading">
              <h2>{t('create.resultTitle')}</h2>
              <p>{t('create.resultDescription')}</p>
            </div>

            <dl className="detail-list">
              <div>
                <dt>{t('create.shortUrl')}</dt>
                <dd>
                  <a href={resultShortUrl} target="_blank" rel="noreferrer">
                    {resultShortUrl}
                  </a>
                </dd>
              </div>
              <div>
                <dt>{t('create.mode')}</dt>
                <dd>
                  {result.randomSubdomain === false
                    ? t('create.fixedModeValue')
                    : t('create.randomModeValue', {
                      length: result.subdomainLength ?? subdomainLength,
                    })}
                </dd>
              </div>
              <div>
                <dt>{t('create.targetUrl')}</dt>
                <dd className="break-all">{getLinkTarget(result)}</dd>
              </div>
              <div>
                <dt>{t('create.responseStatus')}</dt>
                <dd>{result.statusCode ?? 302}</dd>
              </div>
            </dl>

            <LifecycleBadge record={result} />
            <LifecycleDates record={result} />
            <div className="result-actions">
              <button className="button button-primary" type="button" onClick={copyShortUrl}>
                <CopyIcon />
                {copied ? t('create.copied') : t('create.copy')}
              </button>
              <a
                className="button button-secondary"
                href={resultShortUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLinkIcon />
                {t('create.open')}
              </a>
              <button
                className="button button-ghost"
                type="button"
                onClick={() => onManage(result.path)}
              >
                <SearchIcon />
                {t('create.details')}
              </button>
            </div>

            <div className="qr-block">
              <div>
                <h3>{t('create.qrTitle')}</h3>
                <p>{t('create.qrDescription')}</p>
              </div>
              <div className="qr-code">
                <QRCodeSVG
                  ref={qrRef}
                  value={resultShortUrl}
                  size={156}
                  bgColor="#ffffff"
                  fgColor="#111827"
                  level="M"
                />
              </div>
              <button className="button button-secondary" type="button" onClick={downloadQrCode}>
                {t('create.downloadQr')}
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <span className="empty-state-icon">
              <LinkIcon />
            </span>
            <h2>{t('create.emptyTitle')}</h2>
            <p>{t('create.emptyDescription')}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
