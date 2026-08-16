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
import { ThemeToggle } from '@/app/components/ThemeProvider';
import type { PublicApiTarget } from '@/lib/link-types';

type ConsoleSection = 'create' | 'manage';

interface ConsoleDashboardProps {
  targets: PublicApiTarget[];
  defaultTargetId: string | null;
}

const sectionCopy: Record<ConsoleSection, { title: string; description: string }> = {
  create: {
    title: '创建短链',
    description: '创建新的随机子域跳转，并即时获取短链和二维码。',
  },
  manage: {
    title: '链接管理',
    description: '按路径查询后台记录，查看详情或删除已有短链。',
  },
};

export function ConsoleDashboard({
  targets,
  defaultTargetId,
}: ConsoleDashboardProps) {
  const router = useRouter();
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

  const copy = sectionCopy[section];

  return (
    <div className="console-shell">
      <button
        className={mobileMenuOpen ? 'sidebar-backdrop is-open' : 'sidebar-backdrop'}
        type="button"
        aria-label="关闭导航菜单"
        onClick={() => setMobileMenuOpen(false)}
      />

      <aside className={mobileMenuOpen ? 'console-sidebar is-open' : 'console-sidebar'}>
        <div className="sidebar-brand">
          <Image src="/logo.webp" alt="" width={38} height={38} priority />
          <div>
            <strong>短链控制台</strong>
            <span>随机跳转管理</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="主导航">
          <button
            className={section === 'create' ? 'nav-item is-active' : 'nav-item'}
            type="button"
            aria-current={section === 'create' ? 'page' : undefined}
            onClick={() => navigate('create')}
          >
            <CreateIcon />
            <span>创建短链</span>
          </button>
          <button
            className={section === 'manage' ? 'nav-item is-active' : 'nav-item'}
            type="button"
            aria-current={section === 'manage' ? 'page' : undefined}
            onClick={() => navigate('manage')}
          >
            <SearchIcon />
            <span>链接管理</span>
          </button>
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-environment">
          <label htmlFor="environment-select">运行环境</label>
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
              <option value="">未配置环境</option>
            )}
          </select>
          <div className="environment-domain">
            <LinkIcon />
            <span>{selectedTarget?.redirectBaseUrl || '请配置 API_TARGETS'}</span>
          </div>
        </div>

        <div className="sidebar-footer">
          <ThemeToggle />
          <button className="sidebar-action" type="button" onClick={logout}>
            <LogoutIcon />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      <main className="console-main">
        <header className="mobile-header">
          <button
            className="icon-button"
            type="button"
            aria-label="打开导航菜单"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
          >
            <MenuIcon />
          </button>
          <div className="mobile-brand">
            <Image src="/logo.webp" alt="" width={30} height={30} />
            <strong>短链控制台</strong>
          </div>
          <ThemeToggle />
        </header>

        <div className="page-header">
          <div>
            <p className="eyebrow">短链管理控制台</p>
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
            尚未配置运行环境，请在服务端设置 API_TARGETS 环境变量。
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
