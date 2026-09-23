import { Suspense, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderTree, FileText, ListChecks, Timer, Database, SlidersHorizontal, Users, ShieldAlert, ScrollText, LogOut, Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { PageSkeleton, Badge } from '@/components/ui';
import { useAdminStore } from '@/store/authStore';
import { adminApi } from '@/services/api/admin';
import { ROLE_LABELS } from '@/config/constants';
import { cn } from '@/lib/cn';
import { CAN } from './adminShared';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/curriculum', label: 'Curriculum', icon: FolderTree },
  { to: '/admin/materials', label: 'Study Material', icon: FileText },
  { to: '/admin/questions', label: 'Question Bank', icon: ListChecks },
  { to: '/admin/tests', label: 'Tests & Series', icon: Timer },
  { to: '/admin/knowledge-base', label: 'AI Knowledge Base', icon: Database, perm: 'kb' },
  { to: '/admin/config', label: 'Rewards & Config', icon: SlidersHorizontal, perm: 'viewConfig' },
  { to: '/admin/students', label: 'Students', icon: Users, perm: 'students' },
  { to: '/admin/moderation', label: 'Moderation', icon: ShieldAlert },
  { to: '/admin/audit', label: 'Audit Log', icon: ScrollText, perm: 'audit' },
];

export default function AdminLayout() {
  const { admin, clear } = useAdminStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => !n.perm || CAN[n.perm].includes(admin?.role));

  const logout = async () => {
    try { await adminApi.logout(); } catch { /* ignore */ }
    clear();
    navigate('/admin/login', { replace: true });
  };

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Admin">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} onClick={() => setOpen(false)}
          className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', isActive ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white')}
        >
          <i.icon className="h-[18px] w-[18px]" />{i.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-ink-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink-950 px-4 py-5 lg:flex">
        <Logo to="/admin" light />
        <p className="mb-6 mt-1 px-1 text-xs font-semibold uppercase tracking-wider text-white/40">Admin console</p>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="mt-4 rounded-2xl bg-white/5 p-3">
          <p className="truncate text-sm font-semibold text-white">{admin?.name}</p>
          <p className="truncate text-xs text-white/50">{admin?.email}</p>
          <button type="button" onClick={logout} className="mt-3 flex items-center gap-2 text-sm font-semibold text-rose-300 hover:text-rose-200"><LogOut className="h-4 w-4" />Sign out</button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-ink-950 px-4 py-5">
            <div className="mb-6 flex items-center justify-between"><Logo to="/admin" light /><button type="button" onClick={() => setOpen(false)} className="text-white/70" aria-label="Close menu"><X className="h-6 w-6" /></button></div>
            {nav}
            <button type="button" onClick={logout} className="mt-auto flex items-center gap-2 px-3 text-sm font-semibold text-rose-300"><LogOut className="h-4 w-4" />Sign out</button>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-ink-100 bg-white/85 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-ink-100 lg:hidden" aria-label="Open menu"><Menu className="h-6 w-6" /></button>
          <p className="hidden text-sm font-semibold text-ink-500 lg:block">
            Admin console <span className="text-ink-300">/</span> {[...items].reverse().find((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)))?.label || 'Dashboard'}
          </p>
          <div className="flex items-center gap-2">
            <Badge tone="dark">{ROLE_LABELS[admin?.role]}</Badge>
            <Badge tone="success">2FA verified</Badge>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <Suspense fallback={<PageSkeleton />}><Outlet /></Suspense>
        </main>
      </div>
    </div>
  );
}
