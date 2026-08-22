'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreateLinkPanel } from '@/app/components/CreateLinkPanel';
import {
  CreateIcon,
  LinkIcon,
  LogoutIcon,
  MenuIcon,
  SearchIcon,
} from '@/app/components/Icons';
import { LinkManagerPanel } from '@/app/components/LinkManagerPanel';
import { LanguageSwitcher } from '@/app/components/LanguageSwitcher';
import { ThemeToggle } from '@/app/components/ThemeProvider';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { PublicApiTarget } from '@/lib/link-types';

type ConsoleSection = 'create' | 'manage';

interface ConsoleDashboardProps {
  targets: PublicApiTarget[];
  defaultTargetId: string | null;
}

export function ConsoleDashboard({
  targets,
  defaultTargetId,
}: ConsoleDashboardProps) {
  const router = useRouter();
  const { t } = useLocale();
  const initialTargetId =
    targets.some((target) => target.id === defaultTargetId)
      ? defaultTargetId ?? ''
      : targets[0]?.id ?? '';

  const [section, setSection] = useState<ConsoleSection>('create');
  const [selectedTargetId, setSelectedTargetId] = useState(initialTargetId);
  const [managerInitialPath, setManagerInitialPath] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const selectedTarget = useMemo(
    () => targets.find((target) => target.id === selectedTargetId) ?? null,
    [selectedTargetId, targets],
  );

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    }

    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [mobileMenuOpen]);

  function navigate(nextSection: ConsoleSection) {
    setSection(nextSection);
    setMobileMenuOpen(false);
    if (nextSection === 'manage' && section !== 'manage') {
      setManagerInitialPath('');
    }
  }

  function manageCreatedLink(path: string) {
    setManagerInitialPath(path);
    setSection('manage');
    setMobileMenuOpen(false);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const copy = section === 'create'
    ? {
        title: t('dashboard.create'),
        description: t('dashboard.createDescription'),
      }
    : {
        title: t('dashboard.manage'),
        description: t('dashboard.manageDescription'),
      };

  return (
    <div className="console-shell">
      <button
        className={mobileMenuOpen ? 'sidebar-backdrop is-open' : 'sidebar-backdrop'}
        type="button"
        aria-label={t('dashboard.closeMenu')}
        onClick={() => setMobileMenuOpen(false)}
      />

      <aside className={mobileMenuOpen ? 'console-sidebar is-open' : 'console-sidebar'}>
        <div className="sidebar-brand">
          <Image src="/logo.webp" alt="" width={38} height={38} priority />
          <div>
            <strong>{t('dashboard.brand')}</strong>
            <span>{t('dashboard.brandSubtitle')}</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label={t('dashboard.mainNavigation')}>
          <button
            className={section === 'create' ? 'nav-item is-active' : 'nav-item'}
            type="button"
            aria-current={section === 'create' ? 'page' : undefined}
            onClick={() => navigate('create')}
          >
            <CreateIcon />
            <span>{t('dashboard.create')}</span>
          </button>
          <button
            className={section === 'manage' ? 'nav-item is-active' : 'nav-item'}
            type="button"
            aria-current={section === 'manage' ? 'page' : undefined}
            onClick={() => navigate('manage')}
          >
            <SearchIcon />
            <span>{t('dashboard.manage')}</span>
          </button>
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-environment">
          <label htmlFor="environment-select">{t('dashboard.environment')}</label>
          <select
            id="environment-select"
            value={selectedTargetId}
            onChange={(event) => {
              setSelectedTargetId(event.target.value);
              setManagerInitialPath('');
            }}
            disabled={targets.length === 0}
          >
            {targets.length > 0 ? (
              targets.map((target) => (
                <option key={target.id} value={target.id}>{target.name}</option>
              ))
            ) : (
              <option value="">{t('dashboard.environmentMissing')}</option>
            )}
          </select>
          <div className="environment-domain">
            <LinkIcon />
            <span>{selectedTarget?.redirectBaseUrl || t('dashboard.configureTargets')}</span>
          </div>
        </div>

        <LanguageSwitcher />

        <div className="sidebar-footer">
          <ThemeToggle />
          <button className="sidebar-action" type="button" onClick={logout}>
            <LogoutIcon />
            <span>{t('dashboard.logout')}</span>
          </button>
        </div>
      </aside>

      <main className="console-main">
        <header className="mobile-header">
          <button
            className="icon-button"
            type="button"
            aria-label={t('dashboard.openMenu')}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
          >
            <MenuIcon />
          </button>
          <div className="mobile-brand">
            <Image src="/logo.webp" alt="" width={30} height={30} />
            <strong>{t('dashboard.brand')}</strong>
          </div>
          <ThemeToggle />
        </header>

        <div className="page-header">
          <div>
            <p className="eyebrow">{t('dashboard.eyebrow')}</p>
            <h1>{copy.title}</h1>
            <p>{copy.description}</p>
          </div>
          {selectedTarget ? (
            <a
              className="current-domain"
              href={selectedTarget.redirectBaseUrl}
              target="_blank"
              rel="noreferrer"
            >
              <LinkIcon />
              {selectedTarget.redirectBaseUrl.replace(/^https?:\/\//, '')}
            </a>
          ) : null}
        </div>

        {targets.length === 0 ? (
          <div className="alert alert-error configuration-alert" role="alert">
            {t('dashboard.configurationError')}
          </div>
        ) : null}

        {section === 'create' ? (
          <CreateLinkPanel
            key={selectedTargetId}
            target={selectedTarget}
            onManage={manageCreatedLink}
          />
        ) : (
          <LinkManagerPanel
            key={`${selectedTargetId}:${managerInitialPath}`}
            target={selectedTarget}
            initialPath={managerInitialPath}
          />
        )}
      </main>
    </div>
  );
}
