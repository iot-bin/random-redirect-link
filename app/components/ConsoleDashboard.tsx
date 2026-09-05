'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreateLinkPanel } from '@/app/components/CreateLinkPanel';
import {
  ChevronRightIcon,
  CreateIcon,
  LinkIcon,
  LogoutIcon,
  MenuIcon,
  SearchIcon,
  SettingsIcon,
} from '@/app/components/Icons';
import { LinkManagerPanel } from '@/app/components/LinkManagerPanel';
import { SettingsPanel } from '@/app/components/SettingsPanel';
import { ThemeToggle } from '@/app/components/ThemeProvider';
import { useConsolePreferences } from '@/app/components/useConsolePreferences';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { PublicApiTarget } from '@/lib/link-types';

type ConsoleSection = 'create' | 'manage' | 'settings';

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
  const [managerInitialPath, setManagerInitialPath] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const targetIds = useMemo(() => targets.map((target) => target.id), [targets]);
  const { preferences, updatePreferences } = useConsolePreferences(
    targetIds,
    initialTargetId,
  );
  const { targetId: selectedTargetId, pageSize } = preferences;

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

  function changeTarget(targetId: string) {
    updatePreferences({ ...preferences, targetId });
    setManagerInitialPath('');
  }

  function changePageSize(nextPageSize: typeof pageSize) {
    updatePreferences({ ...preferences, pageSize: nextPageSize });
  }

  async function logout() {
    if (logoutPending) return;

    setLogoutPending(true);
    setLogoutError('');

    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) {
        setLogoutError(t('dashboard.logoutFailed'));
        return;
      }

      router.replace('/login');
      router.refresh();
    } catch {
      setLogoutError(t('dashboard.logoutFailed'));
    } finally {
      setLogoutPending(false);
    }
  }

  const copy = {
    create: {
      title: t('dashboard.create'),
      description: t('dashboard.createDescription'),
    },
    manage: {
      title: t('dashboard.manage'),
      description: t('dashboard.manageDescription'),
    },
    settings: {
      title: t('dashboard.settings'),
      description: t('dashboard.settingsDescription'),
    },
  }[section];

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
          <button
            className={section === 'settings' ? 'nav-item is-active' : 'nav-item'}
            type="button"
            aria-current={section === 'settings' ? 'page' : undefined}
            onClick={() => navigate('settings')}
          >
            <SettingsIcon />
            <span>{t('dashboard.settings')}</span>
          </button>
        </nav>

        <div className="sidebar-spacer" />

        <button
          className="sidebar-environment-summary"
          type="button"
          onClick={() => navigate('settings')}
          aria-label={t('dashboard.openEnvironmentSettings')}
        >
          <span className="sidebar-environment-icon"><LinkIcon /></span>
          <span className="sidebar-environment-copy">
            <small>{t('dashboard.environment')}</small>
            <strong>{selectedTarget?.name || t('dashboard.environmentMissing')}</strong>
            <span>{selectedTarget?.redirectBaseUrl || t('dashboard.configureTargets')}</span>
          </span>
          <ChevronRightIcon />
        </button>

        <div className="sidebar-footer">
          <ThemeToggle />
          <button
            className="sidebar-action"
            type="button"
            onClick={logout}
            disabled={logoutPending}
            aria-busy={logoutPending}
          >
            <LogoutIcon />
            <span>{logoutPending ? t('dashboard.loggingOut') : t('dashboard.logout')}</span>
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

        {logoutError ? (
          <div className="alert alert-error configuration-alert" role="alert">
            {logoutError}
          </div>
        ) : null}

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
        ) : section === 'manage' ? (
          <LinkManagerPanel
            key={`${selectedTargetId}:${managerInitialPath}:${pageSize}`}
            target={selectedTarget}
            initialPath={managerInitialPath}
            pageSize={pageSize}
          />
        ) : (
          <SettingsPanel
            targets={targets}
            selectedTargetId={selectedTargetId}
            pageSize={pageSize}
            onTargetChange={changeTarget}
            onPageSizeChange={changePageSize}
          />
        )}
      </main>
    </div>
  );
}
