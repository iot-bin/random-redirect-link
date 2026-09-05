'use client';
import { useEffect, useState } from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { linkState } from '@/lib/link-lifecycle';
import type { LinkRecord } from '@/lib/link-types';
export function useLifecycleClock() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initial = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    window.addEventListener('focus', tick);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      window.removeEventListener('focus', tick);
    };
  }, []);
  return now;
}
export function LifecycleBadge({ record }: { record: LinkRecord }) {
  const { t } = useLocale();
  const now = useLifecycleClock();
  const state = linkState(record, now);
  return (
    <span className={'status-badge life-' + state}>
      {now ? t(`life.${state}`) : '—'}
    </span>
  );
}
export function LifecycleDates({ record }: { record: LinkRecord }) {
  const { locale, t } = useLocale();
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const dates = record.deletedAt
    ? ([
        ['deletedAt', record.deletedAt],
        [
          'purgeAt',
          record.purgeAt
            ? new Date(record.purgeAt * 1000).toISOString()
            : undefined,
        ],
      ] as const)
    : ([
        ['startsAt', record.startsAt],
        ['expiresAt', record.expiresAt],
      ] as const);
  return (
    <div className="lifecycle-dates">
      {dates.map(([key, value]) =>
        value && Number.isFinite(Date.parse(value)) ? (
          <small key={key}>
            {t(`life.${key}`)}: {formatter.format(new Date(value))} UTC+8
          </small>
        ) : null,
      )}
    </div>
  );
}
export function ScheduleFields({
  id,
  startsAt,
  expiresAt,
  onStart,
  onExpiry,
  disabled = false,
}: {
  id: string;
  startsAt: string;
  expiresAt: string;
  onStart: (value: string) => void;
  onExpiry: (value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  return (
    <fieldset className="schedule-fields" disabled={disabled}>
      <legend>{t('life.schedule')}</legend>
      <p className="field-help" id={id + '-help'}>
        {t('life.timeHelp')}
      </p>
      <div className="edit-link-grid">
        {(
          [
            ['startsAt', startsAt, onStart],
            ['expiresAt', expiresAt, onExpiry],
          ] as const
        ).map(([key, value, change]) => (
          <div className="form-field" key={key}>
            <label htmlFor={id + key}>{t(`life.${key}`)}</label>
            <input
              id={id + key}
              type="datetime-local"
              step="1"
              value={value}
              aria-describedby={id + '-help'}
              onChange={(event) => change(event.target.value)}
            />
            {value ? (
              <button
                className="bulk-clear-button"
                type="button"
                onClick={() => change('')}
              >
                {t('life.clear')} {t(`life.${key}`)}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </fieldset>
  );
}
