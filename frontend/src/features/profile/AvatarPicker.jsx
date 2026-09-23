import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Modal } from '@/components/ui';
import { AVATARS } from '@/config/constants';
import { accountApi } from '@/services/api/student';
import { errorMessage } from '@/services/errors';
import { useAuthStore } from '@/store/authStore';
import { invalidate } from '@/hooks/useQuery';
import { cn } from '@/lib/cn';

export function AvatarPicker({ open, onClose }) {
  const { user, setUser } = useAuthStore();
  const [choice, setChoice] = useState(user?.profile?.avatarId);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      setUser(await accountApi.updateSettings({ avatarId: choice }));
      invalidate('leaderboard');
      toast.success('Avatar updated!');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Choose your avatar" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
        {AVATARS.map((a) => (
          <button key={a.id} type="button" onClick={() => setChoice(a.id)} aria-pressed={choice === a.id} aria-label={a.id}
            className={cn('flex aspect-square items-center justify-center rounded-2xl bg-gradient-to-br text-3xl transition hover:scale-105', a.bg, choice === a.id ? 'ring-4 ring-brand-500 ring-offset-2' : 'opacity-80')}
          >{a.emoji}</button>
        ))}
      </div>
    </Modal>
  );
}
