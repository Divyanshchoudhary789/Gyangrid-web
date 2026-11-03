import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Save, History, RotateCcw } from 'lucide-react';
import { Card, CardHeader, Button, TextField, TextArea, Switch, Alert, PageSkeleton, ErrorState, Modal } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { adminApi } from '@/services/api/admin';
import { errorMessage } from '@/services/errors';
import { useDocumentTitle } from '@/hooks/useCommon';
import { formatDateTime } from '@/lib/date';
import { AdminPageHeader, useCan, ReadOnlyNote } from './adminShared';

function Num({ label, value, onChange, disabled, step = 1, min = 0, hint }) {
  return <TextField label={label} type="number" step={step} min={min} value={value} disabled={disabled} hint={hint} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />;
}

const XP_LABELS = {
  DAILY_CHALLENGE: 'Daily Challenge', ALL_CORRECT_BONUS: 'All-correct bonus', PRACTICE_QUESTION: 'Practice question', PRACTICE_DAILY_CAP: 'Practice daily cap',
  MISTAKE_RESOLVED: 'Mistake resolved', MISTAKE_DAILY_CAP: 'Mistake daily cap', TEST_COMPLETED: 'Test completed (1st)', DOUBT_UNDERSTOOD: 'Doubt understood', DOUBT_DAILY_CAP: 'Doubt daily cap',
};

const CONFIG_HELP = {
  maintenanceMode: 'When ON, students see a maintenance screen. Use only during planned downtime.',
  dailyChallengeQuestionCount: 'Number of questions in each Daily Challenge.',
  practiceQuestionLimit: 'Maximum questions in one practice session.',
  featureFlags: 'Turn individual features on or off without a release.',
};
const keyLabel = (k) => String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

/** One backend config key (PATCH /admin/config/:key). Booleans → switch, numbers → input, flag maps → switches, other objects → JSON. */
function ConfigKeyCard({ entry, canEdit, onSaved }) {
  const [value, setValue] = useState(entry.value);
  const [json, setJson] = useState(() => JSON.stringify(entry.value, null, 2));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setValue(entry.value); setJson(JSON.stringify(entry.value, null, 2)); }, [entry.value]);
  const isFlagMap = value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every((v) => typeof v === 'boolean');
  const isJson = value !== null && typeof value === 'object' && !isFlagMap;
  const dirty = isJson ? json !== JSON.stringify(entry.value, null, 2) : JSON.stringify(value) !== JSON.stringify(entry.value);

  const save = async () => {
    let next = value;
    if (isJson) {
      try { next = JSON.parse(json); } catch { toast.error('That is not valid JSON.'); return; }
    }
    if (typeof entry.value === 'number' && (!Number.isFinite(next) || next < 0)) { toast.error('Enter a valid positive number.'); return; }
    setBusy(true);
    try {
      await adminApi.saveConfigKey(entry.key, next);
      toast.success(`${keyLabel(entry.key)} saved.`);
      onSaved();
    } catch (e) { toast.error(e.details?.errors?.[0]?.message || e.details?.errors?.[0] || errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader title={keyLabel(entry.key)} subtitle={entry.description || CONFIG_HELP[entry.key]} />
      {typeof entry.value === 'boolean' ? (
        <Switch label={value ? 'On' : 'Off'} checked={Boolean(value)} disabled={!canEdit} onChange={setValue} />
      ) : typeof entry.value === 'number' ? (
        <Num label="Value" value={value} min={0} disabled={!canEdit} onChange={setValue} />
      ) : isFlagMap ? (
        <div className="space-y-3">{Object.keys(value).map((k) => <Switch key={k} label={keyLabel(k)} checked={value[k]} disabled={!canEdit} onChange={(v) => setValue({ ...value, [k]: v })} />)}</div>
      ) : isJson ? (
        <TextArea label="Value (JSON)" value={json} onChange={(e) => setJson(e.target.value)} rows={6} textareaClassName="font-mono text-xs" disabled={!canEdit} />
      ) : (
        <TextField label="Value" value={value ?? ''} disabled={!canEdit} onChange={(e) => setValue(e.target.value)} />
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-ink-500">{entry.updatedAt ? `Updated ${formatDateTime(entry.updatedAt)}${entry.updatedBy ? ` · ${entry.updatedBy}` : ''}` : ''}</span>
        {canEdit && <Button size="sm" leftIcon={Save} disabled={!dirty} loading={busy} onClick={save}>Save</Button>}
      </div>
    </Card>
  );
}

function KeyConfigPage({ data, canEdit, refetch }) {
  return (
    <div>
      <AdminPageHeader title="Remote config" subtitle="Each key applies immediately — no app release. Every change is written to the audit log." />
      {!canEdit && <ReadOnlyNote />}
      {data.entries.length === 0 ? <Alert tone="info">The backend returned no config keys.</Alert> : (
        <div className="grid gap-5 lg:grid-cols-2">{data.entries.map((e) => <ConfigKeyCard key={e.key} entry={e} canEdit={canEdit} onSaved={refetch} />)}</div>
      )}
      {data.history?.length > 0 && (
        <Card className="mt-5">
          <CardHeader icon={History} title="Change history" />
          <ul className="divide-y divide-ink-100 text-sm">
            {data.history.map((h, i) => (
              <li key={`${h.key}-${h.at}-${i}`} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0"><strong>{keyLabel(h.key)}</strong> <span className="break-all font-mono text-xs text-ink-500">{JSON.stringify(h.before)} → {JSON.stringify(h.after)}</span></span>
                <span className="shrink-0 text-xs text-ink-500">{h.by}{h.at ? ` · ${formatDateTime(h.at)}` : ''}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Remote config manager (F12-07): every tunable, versioned and attributed. Takes effect on the next evaluation — no release. */
export default function ConfigPage() {
  useDocumentTitle('Rewards & config');
  const canEdit = useCan('editConfig');
  const { data, error, loading, refetch } = useQuery('admin:config', adminApi.config, { staleMs: 0 });
  if (data?.entries) return <KeyConfigPage data={data} canEdit={canEdit} refetch={refetch} />;
  return <FullConfig data={data} error={error} loading={loading} refetch={refetch} canEdit={canEdit} />;
}

function FullConfig({ data, error, loading, refetch, canEdit }) {
  const [c, setC] = useState(null);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setC(structuredClone(data.config)); }, [data]);

  if (loading && !data) return <PageSkeleton />;
  if (!data || !c) return <ErrorState error={error} onRetry={refetch} />;

  const upd = (path, value) => setC((prev) => {
    const next = structuredClone(prev);
    let o = next;
    path.slice(0, -1).forEach((k) => { o = o[k]; });
    o[path[path.length - 1]] = value;
    return next;
  });
  const dirty = JSON.stringify(c) !== JSON.stringify(data.config);
  const mixTotal = Object.values(c.challenge.mix).reduce((s, v) => s + Number(v || 0), 0);
  const weightTotal = Math.round((Number(c.mastery.accuracy) + Number(c.mastery.recency) + Number(c.mastery.mistakeResolution)) * 100) / 100;
  const ro = !canEdit;

  const save = async () => {
    setBusy(true);
    try {
      await adminApi.saveConfig(c, note);
      toast.success('Config saved. The next reward evaluation uses the new values.');
      setConfirm(false);
      setNote('');
      refetch();
    } catch (e) { toast.error(e.details?.errors?.[0] || errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <div>
      <AdminPageHeader title="Rewards & remote config" subtitle={`Version ${c.version} · changes apply without an app release`}
        action={canEdit && (<><Button variant="outline" leftIcon={RotateCcw} disabled={!dirty} onClick={() => setC(structuredClone(data.config))}>Reset</Button><Button leftIcon={Save} disabled={!dirty} onClick={() => setConfirm(true)}>Save changes</Button></>)}
      />
      {ro && <ReadOnlyNote />}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Gold Coins" subtitle="Same-day reward rules (15.2)" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Num label="Daily Challenge coins" value={c.coins.DAILY_CHALLENGE.amount} disabled={ro} onChange={(v) => upd(['coins', 'DAILY_CHALLENGE', 'amount'], v)} />
            <Num label="Qualifying score (%)" value={c.coins.DAILY_CHALLENGE.minScorePct} disabled={ro} onChange={(v) => upd(['coins', 'DAILY_CHALLENGE', 'minScorePct'], v)} />
            <Num label="Doubt solved coins" value={c.coins.DOUBT_SOLVED.amount} disabled={ro} onChange={(v) => upd(['coins', 'DOUBT_SOLVED', 'amount'], v)} />
            <Num label="Both-activities bonus" value={c.coins.BOTH_BONUS.amount} disabled={ro} onChange={(v) => upd(['coins', 'BOTH_BONUS', 'amount'], v)} />
          </div>
          <div className="mt-4"><Switch label="Enable same-day bonus" checked={c.coins.BOTH_BONUS.enabled} disabled={ro} onChange={(v) => upd(['coins', 'BOTH_BONUS', 'enabled'], v)} /></div>
        </Card>
        <Card>
          <CardHeader title="XP table" subtitle="Pending sign-off (D-13)" />
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.keys(XP_LABELS).map((k) => <Num key={k} label={XP_LABELS[k]} value={c.xp[k]} disabled={ro} onChange={(v) => upd(['xp', k], v)} />)}
          </div>
          <p className="label mt-4">Streak milestones</p>
          <div className="grid grid-cols-4 gap-2">
            {Object.keys(c.xp.STREAK_MILESTONES).map((d) => <Num key={d} label={`${d} days`} value={c.xp.STREAK_MILESTONES[d]} disabled={ro} onChange={(v) => upd(['xp', 'STREAK_MILESTONES', d], v)} />)}
          </div>
        </Card>
        <Card>
          <CardHeader title="Daily Challenge" />
          <div className="grid gap-3 sm:grid-cols-4">
            <Num label="Size" value={c.challenge.size} min={3} disabled={ro} onChange={(v) => upd(['challenge', 'size'], v)} />
            {['EASY', 'MEDIUM', 'HARD'].map((d) => <Num key={d} label={d} value={c.challenge.mix[d]} disabled={ro} onChange={(v) => upd(['challenge', 'mix', d], v)} />)}
          </div>
          {mixTotal !== Number(c.challenge.size) && <p className="mt-2 text-sm font-semibold text-rose-600">Mix adds up to {mixTotal}; it must equal the size ({c.challenge.size}).</p>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <TextField label="Reminder time" type="time" value={c.challenge.reminderTime} disabled={ro} onChange={(e) => upd(['challenge', 'reminderTime'], e.target.value)} />
            <Num label="Mistake review cycle (days)" value={c.reviewCycleDays} min={1} disabled={ro} onChange={(v) => upd(['reviewCycleDays'], v)} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Mastery weights" subtitle="Pending sign-off (D-12) · must total 1.0" />
          <div className="grid gap-3 sm:grid-cols-4">
            <Num label="Accuracy" step={0.05} value={c.mastery.accuracy} disabled={ro} onChange={(v) => upd(['mastery', 'accuracy'], v)} />
            <Num label="Recency" step={0.05} value={c.mastery.recency} disabled={ro} onChange={(v) => upd(['mastery', 'recency'], v)} />
            <Num label="Resolution" step={0.05} value={c.mastery.mistakeResolution} disabled={ro} onChange={(v) => upd(['mastery', 'mistakeResolution'], v)} />
            <Num label="Min attempts" value={c.mastery.minAttempts} disabled={ro} onChange={(v) => upd(['mastery', 'minAttempts'], v)} />
          </div>
          {weightTotal !== 1 && <p className="mt-2 text-sm font-semibold text-rose-600">Weights total {weightTotal}; they must total 1.0.</p>}
        </Card>
        <Card>
          <CardHeader title="AI usage limits" subtitle="Enforced server-side before any provider call (D-11)" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Num label="Doubts per day" value={c.ai.doubtsPerDay} disabled={ro} onChange={(v) => upd(['ai', 'doubtsPerDay'], v)} />
            <Num label="Doubts per month" value={c.ai.doubtsPerMonth} disabled={ro} onChange={(v) => upd(['ai', 'doubtsPerMonth'], v)} />
            <Num label="Photo doubts per day" value={c.ai.imagesPerDay} disabled={ro} onChange={(v) => upd(['ai', 'imagesPerDay'], v)} />
            <Num label="Max re-explanations" value={c.ai.maxReexplain} disabled={ro} onChange={(v) => upd(['ai', 'maxReexplain'], v)} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Feature flags" />
          <div className="space-y-4">
            <Switch label="Referral engine" description="Keep OFF until rules and anti-abuse are approved (D-09)." checked={c.flags.referrals} disabled={ro} onChange={(v) => upd(['flags', 'referrals'], v)} />
            <Switch label="AI question fallback" description="Serve AI-generated questions only when approved content runs short." checked={c.flags.aiQuestionFallback} disabled={ro} onChange={(v) => upd(['flags', 'aiQuestionFallback'], v)} />
            <Switch label="Weekly parent report" checked={c.flags.parentReport} disabled={ro} onChange={(v) => upd(['flags', 'parentReport'], v)} />
            <Switch label="Voice doubts" checked={c.flags.voiceDoubts} disabled={ro} onChange={(v) => upd(['flags', 'voiceDoubts'], v)} />
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader icon={History} title="Version history" />
        <ul className="divide-y divide-ink-100 text-sm">
          {data.history.map((h) => <li key={`${h.version}-${h.at}`} className="flex flex-wrap justify-between gap-2 py-2.5"><span><strong>v{h.version}</strong> · {h.note}</span><span className="text-xs text-ink-500">{h.by} · {formatDateTime(h.at)}</span></li>)}
        </ul>
      </Card>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Save config changes?" description="This creates a new version and is recorded in the audit log."
        footer={<><Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button><Button loading={busy} disabled={note.trim().length < 4} onClick={save}>Save v{c.version + 1}</Button></>}
      >
        <TextField label="What changed and why?" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Daily Challenge coins 10 → 12 for exam month" data-autofocus />
        <Alert tone="warning" className="mt-3">Reward changes apply to the next evaluation. Existing ledger entries are never modified.</Alert>
      </Modal>
    </div>
  );
}
