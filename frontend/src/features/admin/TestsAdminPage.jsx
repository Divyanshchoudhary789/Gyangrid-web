import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus, Pencil, ArrowUp, ArrowDown, X, Layers, Timer, Wand2, Trash2, Clock, CheckCircle2,
  Calendar, Award, BookOpen, AlertCircle, Sparkles, HelpCircle, Search
} from 'lucide-react';
import {
  Card, Button, TextField, TextArea, SelectField, Checkbox, Tabs, Modal,
  ConfirmDialog, PageSkeleton, ErrorState, Badge, Switch
} from '@/components/ui';
import { MathText } from '@/components/math/MathText';
import { useQuery } from '@/hooks/useQuery';
import { adminApi } from '@/services/api/admin';
import { errorMessage } from '@/services/errors';
import { useDocumentTitle, useDebounced } from '@/hooks/useCommon';
import { humanDuration } from '@/lib/date';
import { cn } from '@/lib/cn';
import { AdminPageHeader, AdminTable, ClassSelect, StatusBadge, useCan, ReadOnlyNote, ADMIN_CAPS, supports } from './adminShared';

const KIND_OPTIONS = [
  { value: 'CHAPTER', label: 'Chapter Test' },
  { value: 'FULL', label: 'Full Syllabus Exam' },
  { value: 'SERIES', label: 'Series Milestone' },
].filter((k) => !ADMIN_CAPS || ADMIN_CAPS.testKinds.includes(k.value));

const DEFAULT_INSTRUCTIONS =
  'Read every question carefully.\nThe timer runs on the server and does not pause.\nYour answers are saved automatically.';

/** ISO → datetime-local string */
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function TestBuilder({ open, onClose, classId, test, onSaved }) {
  const { data: cur } = useQuery(`admin:curriculum:${classId}`, () => adminApi.curriculum(classId));
  const [f, setF] = useState(null);
  const [poolChapter, setPoolChapter] = useState('');
  const [qSearch, setQSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: pool } = useQuery(
    `admin:pool:${poolChapter}`,
    () => adminApi.questions({ classId, chapterId: poolChapter, status: 'APPROVED', pageSize: 50 }),
    { enabled: Boolean(poolChapter) }
  );

  useEffect(() => {
    if (!open) return;
    setF(
      test
        ? {
            title: test.title,
            kind: test.kind,
            chapterIds: test.chapterIds,
            durationMin: Math.round(test.durationSec / 60),
            marksPerQ: test.marksPerQ,
            negativeMarks: test.negativeMarks,
            allowNegativeTotal: test.allowNegativeTotal,
            reattempt: test.reattempt,
            instructions: test.instructions.join('\n'),
            questionIds: test.questionIds,
            status: test.status,
            description: test.description || '',
            passingMarks: test.passingMarks ?? '',
            maxAttempts: test.maxAttempts ?? '',
            publishFrom: toLocalInput(test.publishFrom),
            publishTo: toLocalInput(test.publishTo),
          }
        : {
            maxAttempts: '',
            publishFrom: '',
            publishTo: '',
            title: '',
            description: '',
            kind: 'CHAPTER',
            chapterIds: [],
            durationMin: 15,
            marksPerQ: 1,
            negativeMarks: 0,
            allowNegativeTotal: false,
            reattempt: true,
            instructions: DEFAULT_INSTRUCTIONS,
            questionIds: [],
            status: 'DRAFT',
            passingMarks: '',
          }
    );
    setPoolChapter(test?.chapterIds?.[0] || '');
  }, [open, test]);

  if (!f) return null;
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const toggleQ = (id) =>
    set({
      questionIds: f.questionIds.includes(id)
        ? f.questionIds.filter((x) => x !== id)
        : [...f.questionIds, id],
    });

  const autoPick = () => {
    if (!pool?.items.length) return;
    const fresh = pool.items
      .filter((q) => !f.questionIds.includes(q.questionId))
      .slice(0, 10)
      .map((q) => q.questionId);
    set({ questionIds: [...f.questionIds, ...fresh] });
    toast.success(`Added ${fresh.length} questions from chapter pool.`);
  };

  const save = async (status) => {
    setBusy(true);
    try {
      const body = {
        ...f,
        classId,
        status,
        durationSec: Number(f.durationMin) * 60,
        marksPerQ: Number(f.marksPerQ),
        negativeMarks: Number(f.negativeMarks),
        instructions: f.instructions.split('\n').filter(Boolean),
        passingMarks: f.passingMarks === '' ? null : Number(f.passingMarks),
      };
      if (test) await adminApi.updateTest(test.id, body);
      else await adminApi.createTest(body);
      toast.success(status === 'PUBLISHED' ? 'Test published live!' : 'Test saved as draft.');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await adminApi.deleteTest(test.id);
      toast.success('Test deleted.');
      setConfirmDelete(false);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const filteredPool = pool?.items?.filter(
    (q) => !qSearch || q.questionText.toLowerCase().includes(qSearch.toLowerCase())
  ) || [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={test ? `Edit: ${test.title}` : 'Build New Timed Test'}
      description={`Class ${classId} · Only approved questions from the Question Bank can be attached.`}
      footer={
        <>
          {test && adminApi.deleteTest && (
            <Button
              variant="ghost"
              leftIcon={Trash2}
              className="mr-auto text-rose-600 hover:bg-rose-50"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" loading={busy} onClick={() => save('DRAFT')}>
            Save Draft
          </Button>
          <Button
            variant="brand"
            loading={busy}
            disabled={!f.title.trim() || f.questionIds.length === 0}
            onClick={() => save('PUBLISHED')}
          >
            Publish Test
          </Button>
        </>
      }
    >
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={busy}
        tone="danger"
        title="Delete this test?"
        description="Students who have already taken it will retain their results and scores."
        confirmLabel="Delete"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Test Specifications */}
        <div className="space-y-4">
          <TextField label="Test Title" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Chapter 1 Quiz — Rational Numbers" data-autofocus required />

          {ADMIN_CAPS && (
            <TextArea
              label="Description (Optional)"
              value={f.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={2}
              placeholder="Brief summary of test coverage..."
            />
          )}

          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-ink-50/60 border border-ink-100">
            <SelectField
              label="Test Format"
              value={f.kind}
              onChange={(e) =>
                set({
                  kind: e.target.value,
                  chapterIds: e.target.value === 'CHAPTER' ? f.chapterIds.slice(0, 1) : f.chapterIds,
                })
              }
              options={KIND_OPTIONS}
            />
            <TextField label="Duration (Minutes)" type="number" min={1} value={f.durationMin} onChange={(e) => set({ durationMin: e.target.value })} />
            <TextField label="Marks / Question" type="number" min={0.5} step={0.5} value={f.marksPerQ} onChange={(e) => set({ marksPerQ: e.target.value })} />
            {supports('negativeMarking') && (
              <TextField label="Negative Marks" type="number" min={0} step={0.25} value={f.negativeMarks} onChange={(e) => set({ negativeMarks: e.target.value })} hint="0 = None" />
            )}
            {supports('passingMarks', false) && (
              <TextField label="Passing Marks" type="number" min={0} value={f.passingMarks} onChange={(e) => set({ passingMarks: e.target.value })} hint="Default: 40%" />
            )}
            {supports('maxAttempts', false) && (
              <TextField label="Max Attempts" type="number" min={1} value={f.maxAttempts} onChange={(e) => set({ maxAttempts: e.target.value })} hint="Blank = Unlimited" />
            )}
          </div>

          {supports('publishWindow', false) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Start Availability" type="datetime-local" value={f.publishFrom} onChange={(e) => set({ publishFrom: e.target.value })} />
              <TextField label="End Availability" type="datetime-local" value={f.publishTo} onChange={(e) => set({ publishTo: e.target.value })} />
            </div>
          )}

          {supports('reattemptPolicy') && (
            <Switch label="Allow Re-attempts" description="Only the first attempt counts towards leaderboard rankings." checked={f.reattempt} onChange={(v) => set({ reattempt: v })} />
          )}

          <div>
            <p className="label">{ADMIN_CAPS && f.kind === 'CHAPTER' ? 'Chapter Covered' : 'Chapters Covered'}</p>
            <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-xl border border-ink-100 p-2.5 bg-white">
              {(cur?.chapters || []).map((c) => (
                <Checkbox
                  key={c.id}
                  checked={f.chapterIds.includes(c.id)}
                  label={`${c.number ? `${c.number}. ` : ''}${c.name}`}
                  onChange={(v) =>
                    set({
                      chapterIds:
                        ADMIN_CAPS && f.kind === 'CHAPTER'
                          ? v
                            ? [c.id]
                            : []
                          : v
                          ? [...f.chapterIds, c.id]
                          : f.chapterIds.filter((x) => x !== c.id),
                    })
                  }
                />
              ))}
            </div>
          </div>

          {supports('testInstructions') && (
            <TextArea label="Student Instructions (One per line)" value={f.instructions} onChange={(e) => set({ instructions: e.target.value })} rows={3} />
          )}
        </div>

        {/* Right Column: Question Picker */}
        <div className="flex flex-col h-full">
          <div className="mb-3 flex items-end gap-2">
            <SelectField
              className="flex-1"
              label="Select Chapter Question Pool"
              value={poolChapter}
              placeholder="Choose chapter to browse..."
              onChange={(e) => setPoolChapter(e.target.value)}
              options={(cur?.chapters || []).map((c) => ({ value: c.id, label: `${c.number ? `${c.number}. ` : ''}${c.name}` }))}
            />
            <Button variant="outline" leftIcon={Wand2} onClick={autoPick} disabled={!pool || pool.items?.length === 0}>
              Auto-add 10
            </Button>
          </div>

          {/* Quick search inside pool */}
          {pool && pool.items?.length > 0 && (
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-400" />
              <input
                type="text"
                placeholder="Filter questions in chapter..."
                value={qSearch}
                onChange={(e) => setQSearch(e.target.value)}
                className="input py-1.5 pl-8 text-xs"
              />
            </div>
          )}

          {/* Selected questions header banner */}
          <div className="mb-2 flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900 border border-brand-100">
            <span>{f.questionIds.length} Questions Attached</span>
            <span>
              Total: {f.questionIds.length * Number(f.marksPerQ || 0)} Marks · {f.durationMin}m
            </span>
          </div>

          {/* Questions list container */}
          <div className="max-h-[360px] flex-1 space-y-2 overflow-y-auto rounded-xl border border-ink-100 p-2 bg-ink-50/30">
            {!pool ? (
              <div className="py-12 text-center text-xs text-ink-400">
                <BookOpen className="mx-auto h-6 w-6 text-ink-300 mb-1" />
                Select a chapter above to browse approved questions.
              </div>
            ) : filteredPool.length === 0 ? (
              <p className="p-6 text-center text-xs text-ink-400">No approved questions found in this chapter.</p>
            ) : (
              filteredPool.map((q) => {
                const selected = f.questionIds.includes(q.questionId);
                return (
                  <label
                    key={q.questionId}
                    className={cn(
                      'flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 text-xs transition',
                      selected
                        ? 'border-brand-300 bg-brand-50/50 shadow-sm'
                        : 'border-ink-100 bg-white hover:border-ink-200'
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                      checked={selected}
                      onChange={() => toggleQ(q.questionId)}
                    />
                    <div className="min-w-0 flex-1">
                      <MathText text={q.questionText} className="line-clamp-2 font-medium text-ink-900" />
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-500">
                        <span className="font-semibold uppercase tracking-wider text-brand-700">{q.difficulty}</span>
                        {q.topicName && <span>· {q.topicName}</span>}
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function SeriesBuilder({ open, onClose, classId, series, tests, onSaved }) {
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await adminApi.deleteSeries(series.id);
      toast.success('Series deleted.');
      setConfirmDelete(false);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (open) {
      setF(
        series
          ? {
              title: series.title,
              description: series.description,
              unlockMode: series.unlockMode,
              testIds: series.testIds,
              status: series.status,
            }
          : { title: '', description: '', unlockMode: 'SEQUENTIAL', testIds: [], status: 'DRAFT' }
      );
    }
  }, [open, series]);

  if (!f) return null;

  const move = (i, d) => {
    const ids = [...f.testIds];
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    setF({ ...f, testIds: ids });
  };

  const save = async (status) => {
    setBusy(true);
    try {
      const body = { ...f, classId, status };
      if (series) await adminApi.updateSeries(series.id, body);
      else await adminApi.createSeries(body);
      toast.success(status === 'PUBLISHED' ? 'Series published!' : 'Series saved as draft.');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const available = tests.filter((t) => !f.testIds.includes(t.id));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={series ? `Edit: ${series.title}` : 'Create Structured Test Series'}
      description={`Class ${classId} · Group individual timed tests into an ordered curriculum milestone series.`}
      footer={
        <>
          {series && adminApi.deleteSeries && (
            <Button
              variant="ghost"
              leftIcon={Trash2}
              className="mr-auto text-rose-600 hover:bg-rose-50"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" loading={busy} onClick={() => save('DRAFT')}>
            Save Draft
          </Button>
          <Button
            variant="brand"
            loading={busy}
            disabled={!f.title.trim() || f.testIds.length === 0}
            onClick={() => save('PUBLISHED')}
          >
            Publish Series
          </Button>
        </>
      }
    >
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={busy}
        tone="danger"
        title="Delete this series?"
        description="The individual tests inside this series will not be deleted."
        confirmLabel="Delete"
      />
      <div className="space-y-4">
        <TextField label="Series Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Term 1 Complete Revision Series" required />
        <TextArea label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} placeholder="Explain the focus of this test series..." />

        {supports('seriesUnlockMode') && (
          <SelectField
            label="Test Unlocking Flow"
            value={f.unlockMode}
            onChange={(e) => setF({ ...f, unlockMode: e.target.value })}
            options={[
              { value: 'SEQUENTIAL', label: 'Sequential (Unlocks next test only upon completion)' },
              { value: 'OPEN', label: 'Open Access (Students can attempt any test anytime)' },
            ]}
          />
        )}

        <div>
          <p className="label flex items-center justify-between">
            <span>Tests in Order ({f.testIds.length})</span>
            <span className="text-xs text-ink-400 font-normal">Use arrows to adjust sequence</span>
          </p>
          <ol className="space-y-2 max-h-56 overflow-y-auto rounded-xl border border-ink-100 p-2 bg-ink-50/30">
            {f.testIds.length === 0 ? (
              <p className="py-6 text-center text-xs text-ink-400">No tests added yet. Select from below.</p>
            ) : (
              f.testIds.map((id, i) => {
                const t = tests.find((x) => x.id === id);
                return (
                  <li key={id} className="flex items-center gap-2 rounded-xl border border-ink-100 bg-white p-2.5 text-sm shadow-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-xs text-brand-700">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-ink-900">{t?.title || id}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-ink-400 hover:bg-ink-100 disabled:opacity-30" title="Move up">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button type="button" disabled={i === f.testIds.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-ink-400 hover:bg-ink-100 disabled:opacity-30" title="Move down">
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setF({ ...f, testIds: f.testIds.filter((x) => x !== id) })} className="rounded p-1 text-rose-500 hover:bg-rose-50" title="Remove">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })
            )}
          </ol>
        </div>

        {available.length > 0 && (
          <SelectField
            label="Add Test to Sequence"
            value=""
            placeholder="Choose test to add..."
            onChange={(e) => e.target.value && setF({ ...f, testIds: [...f.testIds, e.target.value] })}
            options={available.map((t) => ({ value: t.id, label: `${t.title} (${t.questionCount}Q · ${humanDuration(t.durationSec)})` }))}
          />
        )}
      </div>
    </Modal>
  );
}

export default function TestsAdminPage() {
  useDocumentTitle('Tests & series');
  const canEdit = useCan('editContent');
  const [classId, setClassId] = useState(8);
  const [tab, setTab] = useState('tests');
  const { data, error, loading, refetch } = useQuery(`admin:tests:${classId}`, () => adminApi.tests(classId), { staleMs: 0 });
  const [editTest, setEditTest] = useState(null);
  const [editSeries, setEditSeries] = useState(null);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Tests & Assessment Series"
        subtitle="Create timed examinations from verified questions and organize them into structured milestones."
        action={
          canEdit &&
          (tab === 'tests' ? (
            <Button variant="brand" leftIcon={Plus} onClick={() => setEditTest({})}>
              Create New Test
            </Button>
          ) : (
            <Button variant="brand" leftIcon={Plus} onClick={() => setEditSeries({})}>
              Create New Series
            </Button>
          ))
        }
      />
      {!canEdit && <ReadOnlyNote />}

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-100 pb-4">
        <ClassSelect value={classId} onChange={setClassId} className="w-48" />
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'tests', label: 'Timed Tests', icon: Timer, count: data?.tests?.length },
            { value: 'series', label: 'Curated Series', icon: Layers, count: data?.series?.length },
          ]}
        />
      </div>

      {loading && !data ? (
        <PageSkeleton rows={2} />
      ) : !data ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : tab === 'tests' ? (
        <AdminTable
          rowKey={(t) => t.id}
          rows={data.tests}
          onRowClick={canEdit ? (t) => setEditTest(t) : undefined}
          empty="No tests created for this class yet. Click 'Create New Test' above."
          columns={[
            {
              key: 'title',
              label: 'Test Name',
              className: 'font-semibold',
              render: (t) => (
                <div className="py-1">
                  <p className="font-semibold text-ink-900">{t.title}</p>
                  <p className="font-mono text-[11px] text-ink-400">ID: …{String(t.id).slice(-6)}</p>
                </div>
              ),
            },
            {
              key: 'kind',
              label: 'Scope',
              render: (t) => (
                <span className={cn('chip font-medium', t.kind === 'FULL' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700')}>
                  {t.kind === 'FULL' ? 'Full Syllabus' : 'Chapter'}
                </span>
              ),
            },
            {
              key: 'q',
              label: 'Questions',
              className: 'text-ink-700 font-medium',
              render: (t) => `${t.questionCount} Questions`,
            },
            {
              key: 'dur',
              label: 'Duration',
              className: 'text-xs text-ink-600',
              render: (t) => (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-ink-400" />
                  {humanDuration(t.durationSec)}
                </span>
              ),
            },
            {
              key: 'marks',
              label: 'Scoring',
              className: 'text-xs text-ink-600',
              render: (t) => (
                <span>
                  {t.marksPerQ}/Q
                  {t.negativeMarks ? ` · -${t.negativeMarks}` : ''}
                  {t.passingMarks != null ? ` · Pass: ${t.passingMarks}/${t.totalMarks}` : ''}
                </span>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (t) => <StatusBadge status={t.status} />,
            },
            {
              key: 'edit',
              label: '',
              render: () => canEdit && <Pencil className="h-4 w-4 text-ink-400 hover:text-brand-600 transition" />,
            },
          ]}
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {data.series?.length === 0 ? (
            <div className="col-span-2 py-12 text-center text-ink-400">
              <Layers className="mx-auto h-8 w-8 text-ink-300 mb-2" />
              <p className="font-semibold text-sm">No test series created for Class {classId} yet.</p>
              <p className="text-xs mt-1">Group individual tests into a guided curriculum milestone.</p>
            </div>
          ) : (
            data.series.map((s) => (
              <Card key={s.id} className="transition hover:border-brand-200">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-bold text-base text-ink-900">{s.title}</h3>
                    {s.description && <p className="text-xs text-ink-500 mt-0.5">{s.description}</p>}
                  </div>
                  <StatusBadge status={s.status} />
                </div>

                <div className="my-3 space-y-1.5 rounded-xl bg-ink-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400 mb-2">
                    Sequence ({s.testIds.length} Tests)
                  </p>
                  {s.testIds.map((id, i) => (
                    <div key={id} className="flex items-center gap-2 text-xs text-ink-700">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white font-bold text-[10px] text-ink-500">
                        {i + 1}
                      </span>
                      <span className="truncate">{data.tests.find((t) => t.id === id)?.title || id}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-ink-100">
                  {supports('seriesUnlockMode') ? (
                    <span className="chip bg-brand-50 text-brand-700 text-[11px]">
                      {s.unlockMode === 'SEQUENTIAL' ? 'Sequential Unlock' : 'Open Access'}
                    </span>
                  ) : <span />}
                  {canEdit && (
                    <Button size="sm" variant="outline" leftIcon={Pencil} onClick={() => setEditSeries(s)}>
                      Configure Series
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      <TestBuilder
        open={Boolean(editTest)}
        onClose={() => setEditTest(null)}
        classId={classId}
        test={editTest?.id ? editTest : null}
        onSaved={refetch}
      />
      <SeriesBuilder
        open={Boolean(editSeries)}
        onClose={() => setEditSeries(null)}
        classId={classId}
        series={editSeries?.id ? editSeries : null}
        tests={data?.tests || []}
        onSaved={refetch}
      />
    </div>
  );
}
