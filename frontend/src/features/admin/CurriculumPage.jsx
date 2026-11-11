import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowUp, ArrowDown, Plus, ChevronDown, Pencil, Check, X, Trash2, GripVertical, BookOpen } from 'lucide-react';
import { Card, Button, TextField, PageSkeleton, ErrorState, Modal, ConfirmDialog } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { adminApi } from '@/services/api/admin';
import { errorMessage } from '@/services/errors';
import { useDocumentTitle } from '@/hooks/useCommon';
import { cn } from '@/lib/cn';
import { AdminPageHeader, ClassSelect, StatusBadge, useCan, ReadOnlyNote, ADMIN_CAPS } from './adminShared';

// Live backend: chapters/topics are simply active (PUBLISHED) or inactive (DRAFT).
const STATUSES = ADMIN_CAPS?.curriculumStatuses || ['DRAFT', 'PUBLISHED', 'RETIRED'];

function InlineName({ value, onSave, disabled }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(value);
  if (!edit) {
    return (
      <span className="flex min-w-0 items-center gap-2 group">
        <span className="truncate font-semibold text-ink-900">{value}</span>
        {!disabled && (
          <button
            type="button"
            onClick={() => { setV(value); setEdit(true); }}
            className="shrink-0 text-ink-300 opacity-0 group-hover:opacity-100 hover:text-brand-600 transition-opacity"
            aria-label="Rename"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
    );
  }
  return (
    <form
      className="flex flex-1 items-center gap-1"
      onSubmit={(e) => { e.preventDefault(); onSave(v); setEdit(false); }}
    >
      <input
        className="input h-8 py-1 text-sm flex-1 min-w-0"
        value={v}
        onChange={(e) => setV(e.target.value)}
        autoFocus
        aria-label="Name"
      />
      <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors" aria-label="Save">
        <Check className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => setEdit(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 transition-colors" aria-label="Cancel">
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}

function StatusToggle({ value, onChange, disabled }) {
  if (disabled) {
    return (
      <span className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        value === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' :
        value === 'DRAFT' ? 'bg-amber-100 text-amber-700' :
        'bg-ink-100 text-ink-500'
      )}>
        {value}
      </span>
    );
  }
  return (
    <div className="flex rounded-lg border border-ink-200 overflow-hidden text-xs font-semibold" role="group" aria-label="Publish state">
      {STATUSES.filter(s => s !== 'RETIRED').map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={cn(
            'px-2.5 py-1 transition-colors',
            value === s
              ? s === 'PUBLISHED'
                ? 'bg-emerald-500 text-white'
                : 'bg-amber-400 text-white'
              : 'bg-white text-ink-500 hover:bg-ink-50'
          )}
        >
          {s === 'PUBLISHED' ? 'Published' : 'Draft'}
        </button>
      ))}
    </div>
  );
}

/** Curriculum manager (F12-02): create, rename, reorder, publish chapters and topics. Default order = NCERT sequence (F3-08). */
export default function CurriculumPage() {
  useDocumentTitle('Curriculum');
  const canEdit = useCan('editContent');
  const [classId, setClassId] = useState(8);
  const { data, error, loading, refetch } = useQuery(`admin:curriculum:${classId}`, () => adminApi.curriculum(classId), { staleMs: 0 });
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(null); // { type: 'chapter' } | { type: 'topic', chapterId }
  const [newName, setNewName] = useState('');
  const [removing, setRemoving] = useState(null); // { type: 'chapter' | 'topic', id, name }

  const remove = () => act(async () => {
    const { type, id } = removing;
    setRemoving(null);
    await (type === 'chapter' ? adminApi.deleteChapter(id) : adminApi.deleteTopic(id));
  }, 'Deleted.');

  const act = async (fn, msg) => {
    try { await fn(); if (msg) toast.success(msg); refetch(); } catch (e) { toast.error(errorMessage(e)); }
  };

  const moveChapter = (i, dir) => {
    const ids = data.chapters.map((c) => c.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    act(() => adminApi.reorderChapters({ classId, chapterIds: ids }));
  };
  const moveTopic = (ch, i, dir) => {
    const ids = ch.topics.map((t) => t.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    act(() => adminApi.reorderTopics(ch.id, ids));
  };
  const create = () => act(async () => {
    if (adding.type === 'chapter') await adminApi.createChapter({ classId, name: newName });
    else await adminApi.addTopic(adding.chapterId, { name: newName });
    setAdding(null);
    setNewName('');
  }, `${adding?.type === 'chapter' ? 'Chapter' : 'Topic'} created as draft.`);

  const CLASS_LABELS = { 6: 'Class 6', 7: 'Class 7', 8: 'Class 8', 9: 'Class 9', 10: 'Class 10' };

  return (
    <div>
      <AdminPageHeader
        title="Curriculum"
        subtitle="Board → Class → Subject → Chapter → Topic. Changes go live on the next app open — no deployment."
        action={canEdit && (
          <Button leftIcon={Plus} onClick={() => setAdding({ type: 'chapter' })}>
            Add chapter
          </Button>
        )}
      />
      {!canEdit && <ReadOnlyNote />}

      {/* Class selector — horizontal pill tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-ink-100 p-1" role="tablist" aria-label="Select class">
          {[6, 7, 8, 9, 10].map((cls) => (
            <button
              key={cls}
              type="button"
              role="tab"
              aria-selected={classId === cls}
              onClick={() => setClassId(cls)}
              className={cn(
                'rounded-lg px-4 py-1.5 text-sm font-semibold transition-all',
                classId === cls
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-ink-500 hover:text-ink-800'
              )}
            >
              {CLASS_LABELS[cls]}
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-500">
          NCERT / CBSE · Mathematics
          {data?.backendClassId && (
            <> · class id <code className="text-xs">{data.backendClassId}</code></>
          )}
        </p>
      </div>

      {loading && !data ? (
        <PageSkeleton rows={2} />
      ) : !data ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div className="space-y-3">
          {data.chapters.length === 0 && (
            <Card className="py-14 text-center">
              <div className="flex flex-col items-center gap-3 text-ink-400">
                <BookOpen className="h-10 w-10 opacity-40" />
                <p className="text-sm">
                  {data.backendClassId === null
                    ? `Class ${classId} has not been created in the backend yet.`
                    : 'No chapters yet. Add the first one.'}
                </p>
                {canEdit && (
                  <Button size="sm" leftIcon={Plus} onClick={() => setAdding({ type: 'chapter' })}>
                    Add first chapter
                  </Button>
                )}
              </div>
            </Card>
          )}

          {data.chapters.map((ch, i) => {
            const isPublished = ch.status === 'PUBLISHED';
            const isExpanded = open === ch.id;

            return (
              <div
                key={ch.id}
                className={cn(
                  'rounded-xl border bg-white shadow-sm overflow-hidden transition-all',
                  isPublished
                    ? 'border-l-4 border-l-brand-500 border-t-ink-100 border-r-ink-100 border-b-ink-100'
                    : 'border-l-4 border-l-ink-200 border-t-ink-100 border-r-ink-100 border-b-ink-100 opacity-85'
                )}
              >
                {/* Chapter header */}
                <div className="flex flex-wrap items-center gap-2 px-4 py-3 group">
                  {/* Drag handle */}
                  <div className="shrink-0 text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                    <GripVertical className="h-4 w-4" aria-hidden="true" />
                  </div>

                  {/* Reorder buttons */}
                  <div className="flex flex-col shrink-0">
                    <button
                      type="button"
                      disabled={!canEdit || i === 0}
                      onClick={() => moveChapter(i, -1)}
                      className="rounded p-0.5 text-ink-300 hover:text-ink-700 disabled:opacity-20 transition-colors"
                      aria-label="Move chapter up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={!canEdit || i === data.chapters.length - 1}
                      onClick={() => moveChapter(i, 1)}
                      className="rounded p-0.5 text-ink-300 hover:text-ink-700 disabled:opacity-20 transition-colors"
                      aria-label="Move chapter down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Chapter number badge */}
                  <span className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    isPublished ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500'
                  )}>
                    {i + 1}
                  </span>

                  {/* Chapter name (inline edit) */}
                  <div className="min-w-0 flex-1">
                    <InlineName
                      value={ch.name}
                      disabled={!canEdit}
                      onSave={(name) => act(() => adminApi.updateChapter(ch.id, { name }), 'Renamed.')}
                    />
                  </div>

                  {/* Backend ID */}
                  {ADMIN_CAPS && (
                    <code className="hidden text-[11px] text-ink-300 md:inline">{ch.id}</code>
                  )}

                  {/* Topic count badge */}
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    isPublished ? 'bg-brand-50 text-brand-600' : 'bg-ink-100 text-ink-500'
                  )}>
                    {ch.topics.length} {ch.topics.length === 1 ? 'topic' : 'topics'}
                  </span>

                  {/* Status toggle */}
                  <StatusToggle
                    value={ch.status}
                    disabled={!canEdit}
                    onChange={(status) => act(() => adminApi.updateChapter(ch.id, { status }), `Chapter ${status.toLowerCase()}.`)}
                  />

                  {/* Delete */}
                  {canEdit && adminApi.deleteChapter && (
                    <button
                      type="button"
                      onClick={() => setRemoving({ type: 'chapter', id: ch.id, name: ch.name })}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                      aria-label={`Delete ${ch.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}

                  {/* Expand/collapse */}
                  <button
                    type="button"
                    onClick={() => setOpen(isExpanded ? null : ch.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 transition-colors"
                    aria-label="Show topics"
                    aria-expanded={isExpanded}
                  >
                    <ChevronDown className={cn('h-5 w-5 transition-transform duration-200', isExpanded && 'rotate-180')} />
                  </button>
                </div>

                {/* Topics panel */}
                {isExpanded && (
                  <div className="border-t border-ink-100 bg-ink-50/50">
                    <div className="relative pl-10 pr-4 py-3 space-y-1.5">
                      {/* Left border line */}
                      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-ink-200 rounded-full" aria-hidden="true" />

                      {ch.topics.length === 0 && (
                        <p className="py-3 text-center text-sm text-ink-400">No topics yet.</p>
                      )}

                      {ch.topics.map((t, j) => (
                        <div
                          key={t.id}
                          className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm border border-ink-100 group"
                        >
                          {/* Drag handle */}
                          <div className="shrink-0 text-ink-200 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                            <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
                          </div>

                          {/* Bullet dot */}
                          <span className={cn(
                            'h-2 w-2 shrink-0 rounded-full',
                            t.status === 'PUBLISHED' ? 'bg-brand-400' : 'bg-ink-300'
                          )} aria-hidden="true" />

                          {/* Reorder */}
                          <div className="flex shrink-0">
                            <button
                              type="button"
                              disabled={!canEdit || j === 0}
                              onClick={() => moveTopic(ch, j, -1)}
                              className="p-1 text-ink-300 disabled:opacity-20 hover:text-ink-600 transition-colors"
                              aria-label="Move topic up"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              disabled={!canEdit || j === ch.topics.length - 1}
                              onClick={() => moveTopic(ch, j, 1)}
                              className="p-1 text-ink-300 disabled:opacity-20 hover:text-ink-600 transition-colors"
                              aria-label="Move topic down"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Topic name */}
                          <div className="min-w-0 flex-1 text-sm">
                            <InlineName
                              value={t.name}
                              disabled={!canEdit}
                              onSave={(name) => act(() => adminApi.updateTopic(t.id, { name }), 'Renamed.')}
                            />
                          </div>

                          <code className="hidden text-[11px] text-ink-300 md:inline">{t.id}</code>

                          {/* Status toggle */}
                          <StatusToggle
                            value={t.status}
                            disabled={!canEdit}
                            onChange={(status) => act(() => adminApi.updateTopic(t.id, { status }), `Topic ${status.toLowerCase()}.`)}
                          />

                          {/* Delete */}
                          {canEdit && adminApi.deleteTopic && (
                            <button
                              type="button"
                              onClick={() => setRemoving({ type: 'topic', id: t.id, name: t.name })}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-300 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                              aria-label={`Delete ${t.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Add topic button */}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => setAdding({ type: 'topic', chapterId: ch.id })}
                          className="mt-1 flex w-full items-center gap-2 rounded-xl border border-dashed border-ink-200 px-3 py-2 text-sm text-ink-400 hover:border-brand-300 hover:text-brand-600 transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                          Add topic
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add chapter button */}
          {canEdit && data.chapters.length > 0 && (
            <button
              type="button"
              onClick={() => setAdding({ type: 'chapter' })}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 py-4 text-sm font-semibold text-ink-400 hover:border-brand-300 hover:text-brand-600 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Add chapter
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        tone="danger"
        title={`Delete "${removing?.name}"?`}
        description={
          removing?.type === 'chapter'
            ? 'Only a chapter with no topics can be deleted. To hide it from students instead, set it to DRAFT.'
            : 'Only a topic with no study material can be deleted. To hide it from students instead, set it to DRAFT.'
        }
        confirmLabel="Delete"
      />

      <Modal
        open={Boolean(adding)}
        onClose={() => setAdding(null)}
        title={adding?.type === 'chapter' ? `New chapter · Class ${classId}` : 'New topic'}
        description="New items start as drafts and are hidden from students until published."
        footer={
          <>
            <Button variant="outline" onClick={() => setAdding(null)}>Cancel</Button>
            <Button disabled={newName.trim().length < 3} onClick={create}>Create</Button>
          </>
        }
      >
        <TextField label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} data-autofocus />
      </Modal>
    </div>
  );
}
