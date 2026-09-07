'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { CloseIcon } from './Icons';
import { useLocale } from '@/lib/i18n/LocaleProvider';

export function DetailsDrawer({ open, onClose, children }: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useLocale();

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const trigger = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <dialog ref={ref} className="details-drawer" aria-labelledby="drawer-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="drawer-content">
        <header className="drawer-heading">
          <h2 id="drawer-title">{t('list.viewDetails')}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('details.close')}>
            <CloseIcon />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
