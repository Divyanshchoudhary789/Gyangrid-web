import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderTree, FileText, ListChecks, Timer,
  Database, SlidersHorizontal, Users, ShieldAlert, ScrollText,
  LogOut, Menu, X, Bell, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '@/components/brand/Logo';
import { PageSkeleton, Badge } from '@/components/ui';
import { useAdminStore } from '@/store/authStore';
import { adminApi } from '@/services/api/admin';
import { ERROR_CODES } from '@/services/errors';
import { ROLE_LABELS } from '@/config/constants';
import { cn } from '@/lib/cn';
import { CAN, ADMIN_CAPS, supports } from './adminShared';

/* ─── Nav definition ─────────────────────────────────────────────────────── */
const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/admin/curriculum',  label: 'Curriculum',     icon: FolderTree },
      { to: '/admin/materials',   label: 'Study Material', icon: FileText },
      { to: '/admin/questions',   label: 'Question Bank',  icon: ListChecks },
      { to: '/admin/tests',       label: 'Tests & Series', icon: Timer },
    ],
  },
  {
    label: 'Platform',
    items: [
      { to: '/admin/students',    label: 'Students',   icon: Users,       perm: 'students' },
      { to: '/admin/moderation',  label: 'Moderation', icon: ShieldAlert, cap: 'moderation' },
      { to: '/admin/audit',       label: 'Audit Log',  icon: ScrollText,  perm: 'audit' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/admin/knowledge-base', label: 'AI Knowledge Base', icon: Database,          perm: 'kb', cap: 'kb' },
      { to: '/admin/config',         label: 'Rewards & Config',  icon: SlidersHorizontal, perm: 'viewConfig' },
    ],
  },
];

/* Flatten for breadcrumb lookup */
const NAV_FLAT = NAV_GROUPS.flatMap((g) => g.items);

/* ─── Notification Bell ───────────────────────────────────────────────────── */
function NotificationBell({ hasAlert }) {
  return (
    <button
      type="button"
      aria-label={hasAlert ? 'Unread moderation alerts' : 'Notifications'}
      className="relative flex h-9 w-9 items-center justify-center rounded-xl text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
    >
      <Bell className="h-5 w-5" aria-hidden />
      {hasAlert && (
        <span
          className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white"
          aria-hidden
        />
      )}
    </button>
  );
}

/* ─── Single nav item ─────────────────────────────────────────────────────── */
function NavItem({ item, onClick }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
          isActive
            ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-lift'
            : 'text-white/60 hover:bg-white/10 hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={cn('h-[18px] w-[18px] shrink-0 transition-transform duration-200', !isActive && 'group-hover:scale-110')}
            aria-hidden
          />
          <span className="flex-1 truncate">{item.label}</span>
          {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden />}
        </>
      )}
    </NavLink>
  );
}

/* ─── Sidebar content ─────────────────────────────────────────────────────── */
function SidebarContent({ items, admin, logout, onNavClick }) {
  const initials = admin?.name
    ? admin.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '??';

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="px-4 pb-4 pt-5">
        <Logo to="/admin" light />
        <p className="mt-1 px-0.5 text-[10px] font-bold uppercase tracking-widest text-white/30">
          Admin console
        </p>
      </div>

      {/* Nav groups */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <nav aria-label="Admin navigation">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter((n) =>
              items.some((i) => i.to === n.to),
            );
            if (!visibleItems.length) return null;
            return (
              <div key={group.label} className="mb-4">
                {group.label !== 'Main' && (
                  <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-white/30">
                    {group.label}
                  </p>
                )}
                <div className="flex flex-col gap-0.5">
                  {visibleItems.map((item) => (
                    <NavItem key={item.to} item={item} onClick={onNavClick} />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Admin user card */}
      <div className="mx-3 mb-4 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-3">
          {/* Avatar circle */}
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-lift">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{admin?.name}</p>
            <p className="truncate text-xs text-white/50">{admin?.email}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="chip bg-brand-500/20 text-brand-200 text-[10px]">
            {ROLE_LABELS[admin?.role] || admin?.role}
          </span>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/15 hover:text-rose-200"
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Layout ─────────────────────────────────────────────────────────── */
export default function AdminLayout() {
  const { admin, clear } = useAdminStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const items = NAV_FLAT.filter(
    (n) => (!n.perm || CAN[n.perm]?.includes(admin?.role)) && (!n.cap || supports(n.cap)),
  );

  /* Derive moderation alert from open moderation cap */
  const hasModerationCap = supports('moderation', false);

  // Real backend: re-check the Firebase session and admin role whenever the console opens.
  useEffect(() => {
    if (!ADMIN_CAPS) return undefined;
    let cancelled = false;
    const toLogin = (reverify) => {
      clear();
      navigate('/admin/login', { replace: true, state: { from: window.location.pathname, reverify } });
    };
    adminApi.me().catch((e) => {
      if (!cancelled) toLogin(e?.code === ERROR_CODES.TWO_FACTOR_REQUIRED);
    });
    // Any admin call can find that the 12-hour 2FA session has ended.
    const onTwoFactor = () => toLogin(true);
    window.addEventListener('gg:two-factor-required', onTwoFactor);
    return () => { cancelled = true; window.removeEventListener('gg:two-factor-required', onTwoFactor); };
  }, [clear, navigate]);

  const logout = async () => {
    try { await adminApi.logout(); } catch { /* ignore */ }
    clear();
    navigate('/admin/login', { replace: true });
  };

  /* Breadcrumb label */
  const currentLabel =
    [...items].reverse().find((i) =>
      i.end ? location.pathname === i.to : location.pathname.startsWith(i.to),
    )?.label || 'Dashboard';

  const sidebarProps = { items, admin, logout, onNavClick: () => setOpen(false) };

  return (
    <div className="min-h-screen bg-ink-50">

      {/* ── Desktop sidebar ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink-950 lg:flex">
        {/* Gradient overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(109,93,252,0.35) 0%, transparent 70%)',
          }}
          aria-hidden
        />
        <div className="relative flex h-full flex-col">
          <SidebarContent {...sidebarProps} />
        </div>
      </aside>

      {/* ── Mobile slide-over ── */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute inset-y-0 left-0 flex w-72 flex-col bg-ink-950"
            >
              {/* Gradient overlay */}
              <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  background:
                    'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(109,93,252,0.35) 0%, transparent 70%)',
                }}
                aria-hidden
              />
              <div className="relative flex h-full flex-col">
                {/* Close button */}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="absolute right-3 top-5 flex h-8 w-8 items-center justify-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
                <SidebarContent {...sidebarProps} />
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* ── Main area ── */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-ink-100 bg-white/85 px-4 backdrop-blur sm:px-6">
          {/* Hamburger */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-600 transition hover:bg-ink-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" aria-hidden />
          </button>

          {/* Breadcrumb */}
          <div className="hidden items-center gap-1.5 text-sm lg:flex">
            <span className="font-medium text-ink-400">Admin console</span>
            <ChevronRight className="h-3.5 w-3.5 text-ink-300" aria-hidden />
            <span className="font-semibold text-ink-800">{currentLabel}</span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <NotificationBell hasAlert={hasModerationCap} />
            <div className="hidden items-center gap-2 sm:flex">
              <Badge tone="dark">{ROLE_LABELS[admin?.role] || admin?.role}</Badge>
              {!ADMIN_CAPS && <Badge tone="success">2FA verified</Badge>}
            </div>
            {/* Admin avatar */}
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
              {admin?.name
                ? admin.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
                : '??'}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <Suspense fallback={<PageSkeleton />}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
