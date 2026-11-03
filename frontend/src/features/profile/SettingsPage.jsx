import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { UserRound, GraduationCap, Bell, ShieldCheck, Download, Trash2, LogOut, ChevronRight, Mail, FileText } from 'lucide-react';
import { PageHeader, Card, CardHeader, Button, TextField, Switch, ChoiceCard, Modal, ConfirmDialog, Alert, Avatar, Skeleton } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { accountApi, curriculumApi } from '@/services/api/student';
import { errorMessage } from '@/services/errors';
import { invalidate, clearQueryCache, useQuery } from '@/hooks/useQuery';
import { useDocumentTitle } from '@/hooks/useCommon';
import { isValidName } from '@/lib/validators';
import { formatDate } from '@/lib/date';
import { classLabel, boardLabel } from '@/features/shared/userDisplay';
import { signOut } from '@/features/auth/session';
import { AvatarPicker } from './AvatarPicker';

export default function SettingsPage() {
  useDocumentTitle('Settings');
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [classOpen, setClassOpen] = useState(false);
  const [newClass, setNewClass] = useState(user?.profile?.classId);
  // Classes of the student's own board, from the live curriculum (class ids are board-specific).
  const { data: boards } = useQuery('boardsWithClasses', curriculumApi.boardsWithClasses, { persist: true, staleMs: 3600000, enabled: classOpen });
  const board = boards?.find((b) => b._id === user?.profile?.boardId) || boards?.[0];
  const classOptions = board?.classes || [];
  const newGrade = classOptions.find((c) => c._id === newClass)?.grade;
  const [classBusy, setClassBusy] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const settings = user?.settings || {};

  const patch = async (body, msg) => {
    try {
      setUser(await accountApi.updateSettings(body));
      if (msg) toast.success(msg);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const saveName = async () => {
    if (!isValidName(name)) { toast.error('Please enter a valid name.'); return; }
    setSavingName(true);
    await patch({ name: name.trim() }, 'Name updated.');
    setSavingName(false);
  };

  const changeClass = async () => {
    setClassBusy(true);
    try {
      setUser(await accountApi.changeClass(newClass));
      clearQueryCache();
      invalidate('');
      toast.success(`Switched to Class ${newGrade ?? ''}. Your XP, coins and streak are unchanged.`);
      setClassOpen(false);
    } catch (e) { toast.error(errorMessage(e)); } finally { setClassBusy(false); }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const data = await accountApi.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gyaangrid-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Your data has been downloaded.');
    } catch (e) { toast.error(errorMessage(e)); } finally { setExporting(false); }
  };

  const deleteAccount = async (typed) => {
    setDeleting(true);
    try {
      const res = await accountApi.deleteAccount(typed);
      toast.success(`Account deleted. Everything will be erased by ${formatDate(`${res.hardDeleteAfter}T12:00:00+05:30`)}.`);
      await signOut(navigate, { silent: true });
    } catch (e) { toast.error(errorMessage(e)); setDeleting(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader back={{ to: '/profile', label: 'Profile' }} title="Settings" />

      <Card>
        <CardHeader icon={UserRound} title="Account" subtitle={user?.email} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <button type="button" onClick={() => setAvatarOpen(true)} className="shrink-0 self-start rounded-full" aria-label="Change avatar"><Avatar id={user?.profile?.avatarId} size="lg" /></button>
          <TextField label="Your name" value={name} onChange={(e) => setName(e.target.value)} className="flex-1" hint={`Classmates see “${user?.displayName}”.`} />
          <Button variant="secondary" onClick={saveName} loading={savingName} disabled={name.trim() === user?.name}>Save</Button>
        </div>
        {!user?.emailVerified && <Alert tone="info" className="mt-4" title="Email not verified">Verify your email from the Home screen so you can always get back into your account.</Alert>}
      </Card>

      <Card>
        <CardHeader icon={GraduationCap} title="Class" subtitle={`${classLabel(user)} · ${boardLabel(user)}`} action={<Button size="sm" variant="outline" onClick={() => setClassOpen(true)}>Change</Button>} />
        <p className="text-sm text-ink-500">Moved up a class? Change it here. Your history is kept separately for each class, and your XP, coins and streak stay the same.</p>
      </Card>

      {accountApi.supportsReminders !== false && (
      <Card>
        <CardHeader icon={Bell} title="Reminders" />
        <div className="space-y-5">
          <Switch label="Daily challenge reminder" description="One gentle reminder if today's challenge isn't done yet." checked={settings.reminders} onChange={(v) => patch({ reminders: v }, v ? 'Reminder on.' : 'Reminder off.')} />
          {settings.reminders && (
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="reminder-time" className="text-sm font-semibold text-ink-800">Remind me at</label>
              <input id="reminder-time" type="time" className="input w-36" value={settings.reminderTime || '17:00'} onChange={(e) => patch({ reminderTime: e.target.value })} />
            </div>
          )}
          <Switch label="Sounds & celebrations" description="Play a sound when you earn a reward." checked={settings.sound} onChange={(v) => patch({ sound: v })} />
        </div>
      </Card>
      )}

      <Card>
        <CardHeader icon={ShieldCheck} title="Parent & privacy" />
        <Link to="/settings/parent-report" className="flex items-center gap-3 rounded-xl border border-ink-100 p-4 transition hover:bg-ink-50">
          <Mail className="h-5 w-5 text-emerald-500" />
          <span className="flex-1"><span className="block font-semibold text-ink-900">Weekly parent report</span><span className="block text-sm text-ink-500">{user?.profile?.parent?.contactMasked ? `For ${user.profile.parent.contactMasked}. ` : ''}See exactly what it will contain.</span></span>
          <ChevronRight className="h-5 w-5 text-ink-300" />
        </Link>
        {accountApi.supportsReminders !== false && (
          <div className="mt-4">
            <Switch label="Send my parent a weekly report" description="A short Sunday summary of your week. Never includes your doubts or answers." checked={settings.parentReport !== false} onChange={(v) => patch({ parentReport: v }, v ? 'Weekly parent report on.' : 'Weekly parent report off.')} />
          </div>
        )}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button variant="outline" leftIcon={Download} loading={exporting} onClick={exportData}>Download my data</Button>
          <Button variant="outline" leftIcon={FileText} to="/privacy">Privacy policy</Button>
        </div>
      </Card>

      <Card className="border-rose-100">
        <CardHeader icon={Trash2} title="Danger zone" />
        <p className="text-sm text-ink-600">Deleting your account removes your profile, progress and mistakes. It&apos;s hidden straight away and fully erased within 30 days. Your parent will be told.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" leftIcon={LogOut} onClick={() => signOut(navigate)}>Sign out</Button>
          <Button variant="danger" leftIcon={Trash2} onClick={() => setDeleteOpen(true)}>Delete my account</Button>
        </div>
      </Card>

      <Modal open={classOpen} onClose={() => setClassOpen(false)} title="Change class" description="Your syllabus switches straight away." footer={<><Button variant="outline" onClick={() => setClassOpen(false)}>Cancel</Button><Button onClick={changeClass} loading={classBusy} disabled={!newGrade || newClass === user?.profile?.classId}>{newGrade ? `Switch to Class ${newGrade}` : 'Choose a class'}</Button></>}>
        {!boards ? (
          <div className="grid grid-cols-5 gap-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}</div>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {classOptions.map((c) => <ChoiceCard key={c._id} selected={newClass === c._id} onClick={() => setNewClass(c._id)} className="py-4 text-center font-display text-lg font-bold">{c.grade}</ChoiceCard>)}
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={deleteAccount} loading={deleting} tone="danger"
        title="Delete your account?" description="This can't be undone after 30 days." confirmLabel="Delete account" typeToConfirm="DELETE"
      />
      <AvatarPicker open={avatarOpen} onClose={() => setAvatarOpen(false)} />
    </div>
  );
}
