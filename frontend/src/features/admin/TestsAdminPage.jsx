import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, ArrowUp, ArrowDown, X, Layers, Timer, Wand2 } from 'lucide-react';
import { Card, Button, TextField, TextArea, SelectField, Checkbox, Tabs, Modal, PageSkeleton, ErrorState, Badge, Switch } from '@/components/ui';
import { MathText } from '@/components/math/MathText';
import { useQuery } from '@/hooks/useQuery';
import { adminApi } from '@/services/api/admin';
import { errorMessage } from '@/services/errors';
import { useDocumentTitle } from '@/hooks/useCommon';
import { humanDuration } from '@/lib/date';
import { cn } from '@/lib/cn';
import { AdminPageHeader, AdminTable, ClassSelect, StatusBadge, useCan, ReadOnlyNote } from './adminShared';

const DEFAULT_INSTRUCTIONS = 'Read every question carefully.\nThe timer runs on the server and does not pause.\nYour answers are saved automatically.';

function TestBuilder({ open, onClose, classId, test, onSaved }) {
  const { data: cur } = useQuery(`admin:curriculum:${classId}`, () => adminApi.curriculum(classId));
  const [f, setF] = useState(null);
  const [poolChapter, setPoolChapter] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: pool } = useQuery(`admin:pool:${poolChapter}`, () => adminApi.questions({ classId, chapterId: poolChapter, status: 'APPROVED', pageSize: 50 }), { enabled: Boolean(poolChapter) });

  useEffect(() => {
    if (!open) return;
    setF(test ? {
      title: test.title, kind: test.kind, chapterIds: test.chapterIds, durationMin: Math.round(test.durationSec / 60), marksPerQ: test.marksPerQ, negativeMarks: test.negativeMarks,
      allowNegativeTotal: test.allowNegativeTotal, reattempt: test.reattempt, instructions: test.instructions.join('\n'), questionIds: test.questionIds, status: test.status,
    } : { title: '', kind: 'CHAPTER', chapterIds: [], durationMin: 15, marksPerQ: 1, negativeMarks: 0, allowNegativeTotal: false, reattempt: true, instructions: DEFAULT_INSTRUCTIONS, questionIds: [], status: 'DRAFT' });
    setPoolChapter(test?.chapterIds?.[0] || '');
  }, [open, test]);

  if (!f) return null;
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const toggleQ = (id) => set({ questionIds: f.questionIds.includes(id) ? f.questionIds.filter((x) => x !== id) : [...f.questionIds, id] });
  const autoPick = () => {
    if (!pool?.items.length) return;
    const fresh = pool.items.filter((q) => !f.questionIds.includes(q.questionId)).slice(0, 10).map((q) => q.questionId);
    set({ questionIds: [...f.questionIds, ...fresh] });
  };

  const save = async (status) => {
    setBusy(true);
    try {
      const body = { ...f, classId, status, durationSec: Number(f.durationMin) * 60, marksPerQ: Number(f.marksPerQ), negativeMarks: Number(f.negativeMarks), instructions: f.instructions.split('\n') };
      if (test) await adminApi.updateTest(test.id, body); else await adminApi.createTest(body);
      toast.success(status === 'PUBLISHED' ? 'Test published.' : 'Test saved as draft.');
      onSaved();
      onClose();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} size="xl" title={test ? 'Edit test' : 'Build a test'} description={`Class ${classId} · only approved questions can be attached`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="secondary" loading={busy} onClick={() => save('DRAFT')}>Save draft</Button><Button loading={busy} onClick={() => save('PUBLISHED')}>Publish</Button></>}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <TextField label="Title" value={f.title} onChange={(e) => set({ title: e.target.value })} data-autofocus />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Type" value={f.kind} onChange={(e) => set({ kind: e.target.value })} options={[{ value: 'CHAPTER', label: 'Chapter test' }, { value: 'FULL', label: 'Full syllabus' }, { value: 'SERIES', label: 'Series test' }]} />
            <TextField label="Duration (min)" type="number" min={1} value={f.durationMin} onChange={(e) => set({ durationMin: e.target.value })} />
            <TextField label="Marks per question" type="number" min={0.5} step={0.5} value={f.marksPerQ} onChange={(e) => set({ marksPerQ: e.target.value })} />
            <TextField label="Negative marks" type="number" min={0} step={0.25} value={f.negativeMarks} onChange={(e) => set({ negativeMarks: e.target.value })} hint="0 = off (default)" />
          </div>
          <Switch label="Allow re-attempts" description="First attempt still counts for rankings." checked={f.reattempt} onChange={(v) => set({ reattempt: v })} />
          <Switch label="Allow negative totals" description="Otherwise the score is floored at 0." checked={f.allowNegativeTotal} onChange={(v) => set({ allowNegativeTotal: v })} />
          <div>
            <p className="label">Chapters covered</p>
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-ink-100 p-3">
              {(cur?.chapters || []).map((c) => <Checkbox key={c.id} checked={f.chapterIds.includes(c.id)} onChange={(v) => set({ chapterIds: v ? [...f.chapterIds, c.id] : f.chapterIds.filter((x) => x !== c.id) })} label={c.name} />)}
            </div>
          </div>
          <TextArea label="Instructions (one per line)" value={f.instructions} onChange={(e) => set({ instructions: e.target.value })} rows={4} />
        </div>
        <div>
          <div className="mb-2 flex items-end gap-2">
            <SelectField className="flex-1" label="Question pool" value={poolChapter} placeholder="Choose a chapter…" onChange={(e) => setPoolChapter(e.target.value)} options={(cur?.chapters || []).map((c) => ({ value: c.id, label: c.name }))} />
            <Button variant="outline" leftIcon={Wand2} onClick={autoPick} disabled={!pool}>Auto-add 10</Button>
          </div>
          <p className="mb-2 text-sm font-semibold text-ink-700">{f.questionIds.length} attached · {f.questionIds.length * Number(f.marksPerQ || 0)} marks · {humanDuration(Number(f.durationMin) * 60)}</p>
          <div className="max-h-[380px] space-y-1.5 overflow-y-auto rounded-xl border border-ink-100 p-2">
            {!pool ? <p className="p-4 text-center text-sm text-ink-400">Pick a chapter to browse approved questions.</p> : pool.items.map((q) => (
              <label key={q.questionId} className={cn('flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm hover:bg-ink-50', f.questionIds.includes(q.questionId) && 'bg-brand-50')}>
                <input type="checkbox" className="mt-1" checked={f.questionIds.includes(q.questionId)} onChange={() => toggleQ(q.questionId)} />
                <span className="min-w-0"><MathText text={q.questionText} className="line-clamp-2" /><span className="block text-[11px] text-ink-400">{q.questionId} · {q.difficulty}</span></span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function SeriesBuilder({ open, onClose, classId, series, tests, onSaved }) {
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setF(series ? { title: series.title, description: series.description, unlockMode: series.unlockMode, testIds: series.testIds, status: series.status } : { title: '', description: '', unlockMode: 'SEQUENTIAL', testIds: [], status: 'DRAFT' });
  }, [open, series]);
  if (!f) return null;
  const move = (i, d) => { const ids = [...f.testIds]; [ids[i], ids[i + d]] = [ids[i + d], ids[i]]; setF({ ...f, testIds: ids }); };
  const save = async (status) => {
    setBusy(true);
    try {
      const body = { ...f, classId, status };
      if (series) await adminApi.updateSeries(series.id, body); else await adminApi.createSeries(body);
      toast.success('Series saved.');
      onSaved();
      onClose();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  const available = tests.filter((t) => !f.testIds.includes(t.id));
  return (
    <Modal open={open} onClose={onClose} size="lg" title={series ? 'Edit series' : 'New test series'}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="secondary" loading={busy} onClick={() => save('DRAFT')}>Save draft</Button><Button loading={busy} onClick={() => save('PUBLISHED')}>Publish</Button></>}
    >
      <div className="space-y-3">
        <TextField label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <TextArea label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} />
        <SelectField label="Unlocking" value={f.unlockMode} onChange={(e) => setF({ ...f, unlockMode: e.target.value })} options={[{ value: 'SEQUENTIAL', label: 'Sequential — each test unlocks after the previous' }, { value: 'OPEN', label: 'Open — all tests available' }]} />
        <p className="label">Tests in order</p>
        <ol className="space-y-1.5">
          {f.testIds.map((id, i) => {
            const t = tests.find((x) => x.id === id);
            return (
              <li key={id} className="flex items-center gap-2 rounded-xl border border-ink-100 p-2 text-sm">
                <span className="w-6 text-center font-bold text-ink-400">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{t?.title || id}</span>
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="p-1 text-ink-400 disabled:opacity-30" aria-label="Up"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" disabled={i === f.testIds.length - 1} onClick={() => move(i, 1)} className="p-1 text-ink-400 disabled:opacity-30" aria-label="Down"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => setF({ ...f, testIds: f.testIds.filter((x) => x !== id) })} className="p-1 text-rose-400" aria-label="Remove"><X className="h-4 w-4" /></button>
              </li>
            );
          })}
        </ol>
        {available.length > 0 && <SelectField label="Add a test" value="" placeholder="Choose…" onChange={(e) => e.target.value && setF({ ...f, testIds: [...f.testIds, e.target.value] })} options={available.map((t) => ({ value: t.id, label: t.title }))} />}
      </div>
    </Modal>
  );
}

/** Test builder + series builder (F12-05, F6-01/02). */
export default function TestsAdminPage() {
  useDocumentTitle('Tests & series');
  const canEdit = useCan('editContent');
  const [classId, setClassId] = useState(8);
  const [tab, setTab] = useState('tests');
  const { data, error, loading, refetch } = useQuery(`admin:tests:${classId}`, () => adminApi.tests(classId), { staleMs: 0 });
  const [editTest, setEditTest] = useState(null);
  const [editSeries, setEditSeries] = useState(null);

  return (
    <div>
      <AdminPageHeader title="Tests & series" subtitle="Assemble timed tests from approved questions, then group them into series."
        action={canEdit && (tab === 'tests' ? <Button leftIcon={Plus} onClick={() => setEditTest({})}>New test</Button> : <Button leftIcon={Plus} onClick={() => setEditSeries({})}>New series</Button>)}
      />
      {!canEdit && <ReadOnlyNote />}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <ClassSelect value={classId} onChange={setClassId} className="w-44" />
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'tests', label: 'Tests', icon: Timer, count: data?.tests.length }, { value: 'series', label: 'Series', icon: Layers, count: data?.series.length }]} />
      </div>
      {loading && !data ? <PageSkeleton rows={1} /> : !data ? <ErrorState error={error} onRetry={refetch} /> : tab === 'tests' ? (
        <AdminTable
          rowKey={(t) => t.id}
          rows={data.tests}
          onRowClick={canEdit ? (t) => setEditTest(t) : undefined}
          columns={[
            { key: 'title', label: 'Title', className: 'font-semibold', render: (t) => <span>{t.title}<span className="block text-xs font-normal text-ink-400">{t.id}</span></span> },
            { key: 'kind', label: 'Type', render: (t) => <Badge>{t.kind}</Badge> },
            { key: 'q', label: 'Questions', render: (t) => t.questionCount },
            { key: 'dur', label: 'Duration', render: (t) => humanDuration(t.durationSec) },
            { key: 'marks', label: 'Marking', className: 'text-xs', render: (t) => `${t.marksPerQ}/Q${t.negativeMarks ? ` · −${t.negativeMarks}` : ''}` },
            { key: 'status', label: 'Status', render: (t) => <StatusBadge status={t.status} /> },
            { key: 'edit', label: '', render: () => canEdit && <Pencil className="h-4 w-4 text-ink-300" /> },
          ]}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.series.map((s) => (
            <Card key={s.id}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-bold">{s.title}</p><p className="text-sm text-ink-500">{s.description}</p></div>
                <StatusBadge status={s.status} />
              </div>
              <ol className="mt-4 space-y-1 text-sm">{s.testIds.map((id, i) => <li key={id} className="truncate text-ink-600">{i + 1}. {data.tests.find((t) => t.id === id)?.title || id}</li>)}</ol>
              <div className="mt-4 flex items-center justify-between"><Badge tone="info">{s.unlockMode}</Badge>{canEdit && <Button size="sm" variant="outline" leftIcon={Pencil} onClick={() => setEditSeries(s)}>Edit</Button>}</div>
            </Card>
          ))}
        </div>
      )}
      <TestBuilder open={Boolean(editTest)} onClose={() => setEditTest(null)} classId={classId} test={editTest?.id ? editTest : null} onSaved={refetch} />
      <SeriesBuilder open={Boolean(editSeries)} onClose={() => setEditSeries(null)} classId={classId} series={editSeries?.id ? editSeries : null} tests={data?.tests || []} onSaved={refetch} />
    </div>
  );
}
