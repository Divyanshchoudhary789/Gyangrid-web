import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Save, History, RotateCcw, Sliders, Coins, Trophy, Flame, Target, Cpu, Flag,
  Clock, ShieldAlert, CheckCircle2, AlertTriangle, Sparkles, Key
} from 'lucide-react';
import { Card, CardHeader, Button, TextField, TextArea, Switch, Alert, PageSkeleton, ErrorState, Modal, Badge } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { adminApi } from '@/services/api/admin';
import { errorMessage } from '@/services/errors';
import { useDocumentTitle } from '@/hooks/useCommon';
import { formatDateTime } from '@/lib/date';
import { cn } from '@/lib/cn';
import { AdminPageHeader, useCan, ReadOnlyNote } from './adminShared';

function Num({ label, value, onChange, disabled, step = 1, min = 0, hint, icon: Icon }) {
  return (
    <div>
      {Icon && (
        <span className="flex items-center gap-1.5 text-xs font-bold text-ink-600 mb-1">
          <Icon className="h-3.5 w-3.5 text-brand-500" />
          {label}
        </span>
      )}
      <TextField
        label={Icon ? undefined : label}
        type="number"
        step={step}
        min={min}
        value={value}
        disabled={disabled}
        hint={hint}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
    </div>
  );
}

const XP_LABELS = {
  DAILY_CHALLENGE: 'Daily Challenge',
  ALL_CORRECT_BONUS: 'All-Correct Bonus',
  PRACTICE_QUESTION: 'Practice Question',
  PRACTICE_DAILY_CAP: 'Practice Daily Cap',
  MISTAKE_RESOLVED: 'Mistake Resolved',
  MISTAKE_DAILY_CAP: 'Mistake Daily Cap',
  TEST_COMPLETED: 'Test Completed (1st)',
  DOUBT_UNDERSTOOD: 'Doubt Understood',
  DOUBT_DAILY_CAP: 'Doubt Daily Cap',
};

const CONFIG_HELP = {
  maintenanceMode: 'When ON, students see a maintenance screen. Use only during planned maintenance.',
  dailyChallengeQuestionCount: 'Number of questions presented in each Daily Challenge.',
  practiceQuestionLimit: 'Maximum questions in one practice session.',
  featureFlags: 'Turn individual platform features on or off without app deployments.',
};

const keyLabel = (k) => String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

function getKeyIcon(key) {
  const k = key.toLowerCase();
  if (k.includes('maintenance')) return ShieldAlert;
  if (k.includes('challenge')) return Target;
  if (k.includes('practice')) return Trophy;
  if (k.includes('flag')) return Flag;
  if (k.includes('ai') || k.includes('token') || k.includes('cost')) return Cpu;
  if (k.includes('coin') || k.includes('reward')) return Coins;
  return Key;
}

/** One backend config key card (PATCH /admin/config/:key). */
function ConfigKeyCard({ entry, canEdit, onSaved }) {
  const [value, setValue] = useState(entry.value);
  const [json, setJson] = useState(() => JSON.stringify(entry.value, null, 2));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValue(entry.value);
    setJson(JSON.stringify(entry.value, null, 2));
  }, [entry.value]);

  const isFlagMap = value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every((v) => typeof v === 'boolean');
  const isJson = value !== null && typeof value === 'object' && !isFlagMap;
  const dirty = isJson ? json !== JSON.stringify(entry.value, null, 2) : JSON.stringify(value) !== JSON.stringify(entry.value);

  const save = async () => {
    let next = value;
    if (isJson) {
      try {
        next = JSON.parse(json);
      } catch {
        toast.error('Invalid JSON syntax.');
        return;
      }
    }
    if (typeof entry.value === 'number' && (!Number.isFinite(next) || next < 0)) {
      toast.error('Enter a valid positive number.');
      return;
    }
    setBusy(true);
    try {
      await adminApi.saveConfigKey(entry.key, next);
      toast.success(`${keyLabel(entry.key)} updated live.`);
      onSaved();
    } catch (e) {
      toast.error(e.details?.errors?.[0]?.message || e.details?.errors?.[0] || errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const Icon = getKeyIcon(entry.key);

  return (
    <Card className={cn('transition border', dirty ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/20' : 'border-ink-100')}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-bold text-sm text-ink-900">{keyLabel(entry.key)}</h3>
            <p className="text-xs text-ink-500">{entry.description || CONFIG_HELP[entry.key] || 'Remote configuration parameter'}</p>
          </div>
        </div>
        {dirty && (
          <span className="chip bg-amber-100 text-amber-800 text-[10px] font-bold">Unsaved</span>
        )}
      </div>

      <div className="my-3">
        {typeof entry.value === 'boolean' ? (
          <div className="flex items-center justify-between rounded-xl bg-ink-50 p-3">
            <span className="text-sm font-semibold text-ink-700">Status</span>
            <Switch label={value ? 'Active (ON)' : 'Disabled (OFF)'} checked={Boolean(value)} disabled={!canEdit} onChange={setValue} />
          </div>
        ) : typeof entry.value === 'number' ? (
          <Num label="Numeric Value" value={value} min={0} disabled={!canEdit} onChange={setValue} />
        ) : isFlagMap ? (
          <div className="space-y-2 rounded-xl bg-ink-50/70 p-3">
            {Object.keys(value).map((k) => (
              <div key={k} className="flex items-center justify-between py-1 border-b border-ink-100 last:border-0">
                <span className="text-xs font-semibold text-ink-700">{keyLabel(k)}</span>
                <Switch checked={value[k]} disabled={!canEdit} onChange={(v) => setValue({ ...value, [k]: v })} />
              </div>
            ))}
          </div>
        ) : isJson ? (
          <TextArea label="JSON Configuration" value={json} onChange={(e) => setJson(e.target.value)} rows={6} textareaClassName="font-mono text-xs" disabled={!canEdit} />
        ) : (
          <TextField label="Value" value={value ?? ''} disabled={!canEdit} onChange={(e) => setValue(e.target.value)} />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-ink-100">
        <span className="text-[11px] text-ink-400">
          {entry.updatedAt ? `Updated ${formatDateTime(entry.updatedAt)}${entry.updatedBy ? ` · ${entry.updatedBy}` : ''}` : 'Default value'}
        </span>
        {canEdit && (
          <Button size="sm" variant={dirty ? 'brand' : 'outline'} leftIcon={Save} disabled={!dirty} loading={busy} onClick={save}>
            Apply Change
          </Button>
        )}
      </div>
    </Card>
  );
}

function KeyConfigPage({ data, canEdit, refetch }) {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Remote Platform Config"
        subtitle="Live parameter adjustments. Updates propagate instantly to all clients without releasing a new build."
      />
      {!canEdit && <ReadOnlyNote />}

      {data.entries.length === 0 ? (
        <Alert tone="info">No configuration keys returned by the backend.</Alert>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {data.entries.map((e) => (
            <ConfigKeyCard key={e.key} entry={e} canEdit={canEdit} onSaved={refetch} />
          ))}
        </div>
      )}

      {data.history?.length > 0 && (
        <Card className="mt-6">
          <CardHeader icon={History} title="Config Audit Trail" subtitle="Recent parameter modifications" />
          <ul className="divide-y divide-ink-100 text-sm">
            {data.history.map((h, i) => (
              <li key={`${h.key}-${h.at}-${i}`} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <strong className="text-ink-900">{keyLabel(h.key)}</strong>{' '}
                  <span className="font-mono text-xs text-ink-500 bg-ink-50 px-2 py-0.5 rounded">
                    {JSON.stringify(h.before)} → {JSON.stringify(h.after)}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-ink-400">
                  {h.by} {h.at ? `· ${formatDateTime(h.at)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Full Config mode (rich nested parameters) */
function FullConfig({ data, error, loading, refetch, canEdit }) {
  const [c, setC] = useState(null);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setC(structuredClone(data.config));
  }, [data]);

  if (loading && !data) return <PageSkeleton />;
  if (!data || !c) return <ErrorState error={error} onRetry={refetch} />;

  const upd = (path, value) =>
    setC((prev) => {
      const next = structuredClone(prev);
      let o = next;
      path.slice(0, -1).forEach((k) => {
        o = o[k];
      });
      o[path[path.length - 1]] = value;
      return next;
    });

  const dirty = JSON.stringify(c) !== JSON.stringify(data.config);
  const mixTotal = Object.values(c.challenge?.mix || {}).reduce((s, v) => s + Number(v || 0), 0);
  const weightTotal = Math.round((Number(c.mastery?.accuracy || 0) + Number(c.mastery?.recency || 0) + Number(c.mastery?.mistakeResolution || 0)) * 100) / 100;
  const ro = !canEdit;

  const save = async () => {
    setBusy(true);
    try {
      await adminApi.saveConfig(c, note);
      toast.success('Config saved! Next evaluation will use updated parameters.');
      setConfirm(false);
      setNote('');
      refetch();
    } catch (e) {
      toast.error(e.details?.errors?.[0] || errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Rewards & Engine Rules"
        subtitle={`Configuration v${c.version} · Modifies gamification, XP, rewards, and AI limits live.`}
        action={
          canEdit && (
            <div className="flex items-center gap-2">
              <Button variant="outline" leftIcon={RotateCcw} disabled={!dirty} onClick={() => setC(structuredClone(data.config))}>
                Reset
              </Button>
              <Button variant="brand" leftIcon={Save} disabled={!dirty} onClick={() => setConfirm(true)}>
                Save Changes
              </Button>
            </div>
          )
        }
      />
      {ro && <ReadOnlyNote />}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gold Coins card */}
        <Card>
          <CardHeader icon={Coins} title="Gold Coins & Streak Economy" subtitle="Rewards rules for activity completion" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Num label="Daily Challenge Coins" value={c.coins?.DAILY_CHALLENGE?.amount} disabled={ro} onChange={(v) => upd(['coins', 'DAILY_CHALLENGE', 'amount'], v)} />
            <Num label="Min Score Required (%)" value={c.coins?.DAILY_CHALLENGE?.minScorePct} disabled={ro} onChange={(v) => upd(['coins', 'DAILY_CHALLENGE', 'minScorePct'], v)} />
            <Num label="Doubt Solved Reward" value={c.coins?.DOUBT_SOLVED?.amount} disabled={ro} onChange={(v) => upd(['coins', 'DOUBT_SOLVED', 'amount'], v)} />
            <Num label="Both-Activities Bonus" value={c.coins?.BOTH_BONUS?.amount} disabled={ro} onChange={(v) => upd(['coins', 'BOTH_BONUS', 'amount'], v)} />
          </div>
          <div className="mt-4 pt-3 border-t border-ink-100">
            <Switch label="Enable Same-Day Both-Activities Bonus" checked={c.coins?.BOTH_BONUS?.enabled} disabled={ro} onChange={(v) => upd(['coins', 'BOTH_BONUS', 'enabled'], v)} />
          </div>
        </Card>

        {/* XP Table */}
        <Card>
          <CardHeader icon={Trophy} title="Experience Points (XP) Table" subtitle="Leveling speed and mastery incentives" />
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.keys(XP_LABELS).map((k) => (
              <Num key={k} label={XP_LABELS[k]} value={c.xp?.[k]} disabled={ro} onChange={(v) => upd(['xp', k], v)} />
            ))}
          </div>
          <p className="label mt-4 flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-flame-500" /> Streak Milestone Bonuses (XP)
          </p>
          <div className="grid grid-cols-4 gap-2">
            {Object.keys(c.xp?.STREAK_MILESTONES || {}).map((d) => (
              <Num key={d} label={`${d} Days`} value={c.xp.STREAK_MILESTONES[d]} disabled={ro} onChange={(v) => upd(['xp', 'STREAK_MILESTONES', d], v)} />
            ))}
          </div>
        </Card>

        {/* Daily Challenge Builder */}
        <Card>
          <CardHeader icon={Target} title="Daily Challenge Configuration" subtitle="Question sizing and difficulty distribution" />
          <div className="grid gap-3 sm:grid-cols-4">
            <Num label="Question Count" value={c.challenge?.size} min={3} disabled={ro} onChange={(v) => upd(['challenge', 'size'], v)} />
            {['EASY', 'MEDIUM', 'HARD'].map((d) => (
              <Num key={d} label={`${d} Count`} value={c.challenge?.mix?.[d]} disabled={ro} onChange={(v) => upd(['challenge', 'mix', d], v)} />
            ))}
          </div>
          {mixTotal !== Number(c.challenge?.size) && (
            <p className="mt-2 text-xs font-semibold text-rose-600 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Mix totals {mixTotal}; must equal overall challenge size ({c.challenge?.size}).
            </p>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 pt-3 border-t border-ink-100">
            <TextField label="Daily Push Notification Time" type="time" value={c.challenge?.reminderTime} disabled={ro} onChange={(e) => upd(['challenge', 'reminderTime'], e.target.value)} />
            <Num label="Mistake Review Cycle (Days)" value={c.reviewCycleDays} min={1} disabled={ro} onChange={(v) => upd(['reviewCycleDays'], v)} />
          </div>
        </Card>

        {/* AI Usage Limits */}
        <Card>
          <CardHeader icon={Cpu} title="AI Tutor Guardrails" subtitle="Server-side limits to prevent abuse and manage token budgets" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Num label="Max Doubts / Day" value={c.ai?.doubtsPerDay} disabled={ro} onChange={(v) => upd(['ai', 'doubtsPerDay'], v)} />
            <Num label="Max Doubts / Month" value={c.ai?.doubtsPerMonth} disabled={ro} onChange={(v) => upd(['ai', 'doubtsPerMonth'], v)} />
            <Num label="Photo Doubts / Day" value={c.ai?.imagesPerDay} disabled={ro} onChange={(v) => upd(['ai', 'imagesPerDay'], v)} />
            <Num label="Max Re-explanations" value={c.ai?.maxReexplain} disabled={ro} onChange={(v) => upd(['ai', 'maxReexplain'], v)} />
          </div>
        </Card>

        {/* Feature Flags */}
        <Card className="lg:col-span-2">
          <CardHeader icon={Flag} title="Feature Switches" subtitle="Enable or disable capabilities on the fly" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-ink-100 p-3.5">
              <Switch label="Student Referral Engine" description="Reward referral coins and invite links." checked={c.flags?.referrals} disabled={ro} onChange={(v) => upd(['flags', 'referrals'], v)} />
            </div>
            <div className="rounded-xl border border-ink-100 p-3.5">
              <Switch label="AI Question Fallback" description="Serve AI-generated questions when approved pool is depleted." checked={c.flags?.aiQuestionFallback} disabled={ro} onChange={(v) => upd(['flags', 'aiQuestionFallback'], v)} />
            </div>
            <div className="rounded-xl border border-ink-100 p-3.5">
              <Switch label="Weekly Parent Progress Reports" description="Send automated email summaries to verified parents." checked={c.flags?.parentReport} disabled={ro} onChange={(v) => upd(['flags', 'parentReport'], v)} />
            </div>
            <div className="rounded-xl border border-ink-100 p-3.5">
              <Switch label="Voice-Activated Doubts" description="Allow students to speak math questions directly." checked={c.flags?.voiceDoubts} disabled={ro} onChange={(v) => upd(['flags', 'voiceDoubts'], v)} />
            </div>
          </div>
        </Card>
      </div>

      {/* Version History */}
      <Card className="mt-6">
        <CardHeader icon={History} title="Version Release History" subtitle="Changes logged with timestamp and author" />
        <ul className="divide-y divide-ink-100 text-sm">
          {(data.history || []).map((h) => (
            <li key={`${h.version}-${h.at}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="flex items-center gap-2">
                <Badge tone="brand">v{h.version}</Badge>
                <span className="font-medium text-ink-800">{h.note}</span>
              </span>
              <span className="text-xs text-ink-400">
                {h.by} · {formatDateTime(h.at)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Confirmation Modal */}
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Publish Configuration Change"
        description="This will increment the active configuration version and write an audit entry."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button variant="brand" loading={busy} disabled={note.trim().length < 4} onClick={save}>
              Publish v{(c.version || 0) + 1}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <TextField
            label="Changelog Note (Required)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Increased daily challenge coin bonus for exam week"
            data-autofocus
            required
          />
          <Alert tone="warning">
            Reward changes take effect immediately for new actions. Historical reward transactions and coin ledgers are never altered.
          </Alert>
        </div>
      </Modal>
    </div>
  );
}

export default function ConfigPage() {
  useDocumentTitle('Rewards & config');
  const canEdit = useCan('editConfig');
  const { data, error, loading, refetch } = useQuery('admin:config', adminApi.config, { staleMs: 0 });

  if (data?.entries) return <KeyConfigPage data={data} canEdit={canEdit} refetch={refetch} />;
  return <FullConfig data={data} error={error} loading={loading} refetch={refetch} canEdit={canEdit} />;
}
