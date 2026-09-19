'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreateLinkPanel } from '@/app/components/CreateLinkPanel';
import {
  CreateIcon,
  LinkIcon,
  LogoutIcon,
  MenuIcon,
  SearchIcon,
  SettingsIcon,
  TrashIcon,
} from '@/app/components/Icons';
import { LinkManagerPanel } from '@/app/components/LinkManagerPanel';
import { SettingsPanel } from '@/app/components/SettingsPanel';
import { ThemeToggle } from '@/app/components/ThemeProvider';
import { ControlPanel } from './ControlPanel';
import { MfaPanel } from './MfaPanel';
import { DropdownSelect } from './DropdownSelect';
import { normalizePageSize } from '@/lib/console-preferences';
import type { ConsoleContext } from './ConsoleLoader';
import { controlCopy } from '@/lib/control-copy';
import { useLocale } from '@/lib/i18n/LocaleProvider';


type ConsoleSection = 'create' | 'manage' | 'trash' | 'settings';

interface ConsoleDashboardProps extends ConsoleContext {
  onConfigurationChange: () => void;
}

export function ConsoleDashboard({
  targets,
  defaultTargetId, preferences: savedPreferences, site, user, onConfigurationChange,
}: ConsoleDashboardProps) {
  const router = useRouter();
  const { t, locale } = useLocale();
  const initialTargetId =
    targets.some((target) => target.id === defaultTargetId)
      ? defaultTargetId ?? ''
      : targets[0]?.id ?? '';

  const [section, setSection] = useState<ConsoleSection>(targets.find(t => t.id === initialTargetId)?.canWrite ? 'create' : 'manage');
  const [managerInitialPath, setManagerInitialPath] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [preferences, setPreferences] = useState({
    targetId: initialTargetId, pageSize: normalizePageSize(savedPreferences.pageSize),
  });
  const [preferenceError, setPreferenceError] = useState('');
  const preferenceQueue = useRef<Promise<void>>(Promise.resolve());
  function updatePreferences(next: typeof preferences) {
    setPreferences(next);
    setPreferenceError('');
    preferenceQueue.current = preferenceQueue.current.catch(() => {}).then(async () => {
      const response = await fetch('/api/control/preferences', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next),
      });
      if (!response.ok) throw new Error('Preference save failed');
    }).catch(() => setPreferenceError(t('api.unavailable')));
  }
  const { pageSize } = preferences;
  const selectedTargetId = targets.some(t => t.id === preferences.targetId) ? preferences.targetId : initialTargetId;

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
    if (section === 'create' && !targets.find(t => t.id === targetId)?.canWrite) setSection('manage');
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
    trash: { title: t('life.trash'), description: t('life.trashHelp') },
    settings: {
      title: t('dashboard.settings'),
      description: t('dashboard.settingsDescription'),
    },
  }[section];

  return (
    <div className={sidebarCollapsed ? "console-shell sidebar-collapsed" : "console-shell"}>
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
            <strong>{site.title || t('dashboard.brand')}</strong>
            <span>{t('dashboard.brandSubtitle')}</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label={t('dashboard.mainNavigation')}>
          <span className="nav-active-indicator" aria-hidden="true" style={{ top: `${Math.max(0, (selectedTarget?.canWrite ? ['create','manage','trash','settings'] : ['manage','trash','settings']).indexOf(section)) * 44}px` }} />
          {selectedTarget?.canWrite ? <button
            className={section === 'create' ? 'nav-item is-active' : 'nav-item'}
            type="button"
            title={t('dashboard.create')}
            aria-current={section === 'create' ? 'page' : undefined}
            onClick={() => navigate('create')}
          >
            <CreateIcon />
            <span>{t('dashboard.create')}</span>
          </button> : null}
          <button
            className={section === 'manage' ? 'nav-item is-active' : 'nav-item'}
            type="button"
            title={t('dashboard.manage')}
            aria-current={section === 'manage' ? 'page' : undefined}
            onClick={() => navigate('manage')}
          >
            <SearchIcon />
            <span>{t('dashboard.manage')}</span>
          </button>
          <button title={t('life.trash')} className={section === 'trash' ? 'nav-item is-active' : 'nav-item'} type="button" aria-current={section === 'trash' ? 'page' : undefined} onClick={() => navigate('trash')}><TrashIcon /><span>{t('life.trash')}</span></button>
          <button
            className={section === 'settings' ? 'nav-item is-active' : 'nav-item'}
            type="button"
            title={t('dashboard.settings')}
            aria-current={section === 'settings' ? 'page' : undefined}
            onClick={() => navigate('settings')}
          >
            <SettingsIcon />
            <span>{t('dashboard.settings')}</span>
          </button>
        </nav>

        <div className="sidebar-spacer" />

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
          <strong className="mobile-page-title">{copy.title}</strong>
          <ThemeToggle />
        </header>

        <div className="console-topbar">
          <div className="console-context">
            <button className="icon-button sidebar-collapse" type="button" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} aria-label={t(sidebarCollapsed ? 'dashboard.expandSidebar' : 'dashboard.collapseSidebar')} aria-expanded={!sidebarCollapsed}>
              <MenuIcon />
            </button>
            <DropdownSelect className="nav-environment-switcher" ariaLabel={t('dashboard.environment')} value={selectedTargetId} disabled={!targets.length}
              options={targets.map(target=>({value:target.id,label:target.name,description:target.redirectBaseUrl.replace(/^https?:\/\//,'')}))}
              onChange={changeTarget} />
          </div>
          <strong className="console-topbar-title">{copy.title}</strong>
          <div className="console-topbar-actions">{section !== 'create' && selectedTarget?.canWrite ? <button className="button button-primary" type="button" onClick={() => navigate('create')}><CreateIcon />{t('dashboard.create')}</button> : null}</div>
        </div>

        <div className="page-header">
          <div>
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

        {preferenceError ? <div className="alert alert-error" role="alert">{preferenceError}</div> : null}
        {logoutError ? (
          <div className="alert alert-error configuration-alert" role="alert">
            {logoutError}
          </div>
        ) : null}

        {selectedTarget && !selectedTarget.canWrite ? <p className="alert" role="status">{controlCopy[locale].readonly}</p> : null}
        {targets.length === 0 ? (
          <div className="alert alert-error configuration-alert" role="alert">
            {t('dashboard.configurationError')}
          </div>
        ) : null}

        <div key={section} className="console-view">
        {section === 'create' && selectedTarget?.canWrite ? (
          <CreateLinkPanel
            key={selectedTargetId}
            target={selectedTarget}
            onManage={manageCreatedLink}
          />
        ) : section === 'manage' || section === 'trash' ? (
          <LinkManagerPanel
            key={`${selectedTargetId}:${section}:${managerInitialPath}:${pageSize}`}
            view={section === 'trash' ? 'trash' : 'links'}
            target={selectedTarget}
            initialPath={section === 'trash' ? '' : managerInitialPath}
            pageSize={pageSize}
          />
        ) : (
          <div className="settings-stack">
          <SettingsPanel
            targets={targets}
            selectedTargetId={selectedTargetId}
            pageSize={pageSize}
            onTargetChange={changeTarget}
            onPageSizeChange={changePageSize}
          />
          <MfaPanel />
          {user.role === 'admin' ? <ControlPanel onChange={onConfigurationChange} currentSub={user.sub} /> : null}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
