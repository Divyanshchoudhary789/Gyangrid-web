import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowUp, ArrowDown, Plus, ChevronDown, Pencil, Check, X, Trash2 } from 'lucide-react';
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
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-semibold text-ink-900">{value}</span>
        {!disabled && <button type="button" onClick={() => { setV(value); setEdit(true); }} className="shrink-0 text-ink-300 hover:text-brand-600" aria-label="Rename"><Pencil className="h-3.5 w-3.5" /></button>}
      </span>
    );
  }
  return (
    <form className="flex flex-1 items-center gap-1" onSubmit={(e) => { e.preventDefault(); onSave(v); setEdit(false); }}>
      <input className="input h-9 py-1" value={v} onChange={(e) => setV(e.target.value)} autoFocus aria-label="Name" />
      <button type="submit" className="flex h-9 w-9 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50" aria-label="Save"><Check className="h-4 w-4" /></button>
      <button type="button" onClick={() => setEdit(false)} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100" aria-label="Cancel"><X className="h-4 w-4" /></button>
    </form>
  );
}

function StatusSelect({ value, onChange, disabled }) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-lg border border-ink-200 bg-white px-2 text-xs font-semibold" aria-label="Publish state">
      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
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

  return (
    <div>
      <AdminPageHeader title="Curriculum" subtitle="Board → Class → Subject → Chapter → Topic. Changes go live on the next app open — no deployment." action={canEdit && <Button leftIcon={Plus} onClick={() => setAdding({ type: 'chapter' })}>Add chapter</Button>} />
      {!canEdit && <ReadOnlyNote />}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <ClassSelect value={classId} onChange={setClassId} className="w-44" />
        <p className="pb-3 text-sm text-ink-500">NCERT / CBSE · Mathematics{data?.backendClassId && <> · class id <code className="text-xs">{data.backendClassId}</code></>}</p>
      </div>
      {loading && !data ? <PageSkeleton rows={2} /> : !data ? <ErrorState error={error} onRetry={refetch} /> : (
        <div className="space-y-2">
          {data.chapters.length === 0 && <Card className="py-10 text-center text-sm text-ink-500">{data.backendClassId === null ? `Class ${classId} has not been created in the backend yet.` : 'No chapters yet. Add the first one.'}</Card>}
          {data.chapters.map((ch, i) => (
            <Card key={ch.id} padded={false} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 p-3 sm:px-4">
                <div className="flex flex-col">
                  <button type="button" disabled={!canEdit || i === 0} onClick={() => moveChapter(i, -1)} className="rounded p-0.5 text-ink-400 hover:text-ink-800 disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" disabled={!canEdit || i === data.chapters.length - 1} onClick={() => moveChapter(i, 1)} className="rounded p-0.5 text-ink-400 hover:text-ink-800 disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
                </div>
                <span className="w-8 text-center font-display font-bold text-ink-400">{i + 1}</span>
                <div className="min-w-0 flex-1"><InlineName value={ch.name} disabled={!canEdit} onSave={(name) => act(() => adminApi.updateChapter(ch.id, { name }), 'Renamed.')} /></div>
                {ADMIN_CAPS && <code className="hidden text-[11px] text-ink-400 md:inline">{ch.id}</code>}
                <span className="text-xs text-ink-500">{ch.topics.length} topics</span>
                <StatusBadge status={ch.status} />
                {canEdit && <StatusSelect value={ch.status} onChange={(status) => act(() => adminApi.updateChapter(ch.id, { status }), `Chapter ${status.toLowerCase()}.`)} />}
                {canEdit && adminApi.deleteChapter && <button type="button" onClick={() => setRemoving({ type: 'chapter', id: ch.id, name: ch.name })} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${ch.name}`}><Trash2 className="h-4 w-4" /></button>}
                <button type="button" onClick={() => setOpen(open === ch.id ? null : ch.id)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-ink-100" aria-label="Show topics" aria-expanded={open === ch.id}><ChevronDown className={cn('h-5 w-5 transition', open === ch.id && 'rotate-180')} /></button>
              </div>
              {open === ch.id && (
                <div className="space-y-1.5 border-t border-ink-100 bg-ink-50/60 p-3 sm:pl-16">
                  {ch.topics.map((t, j) => (
                    <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2 pl-3 shadow-sm">
                      <div className="flex">
                        <button type="button" disabled={!canEdit || j === 0} onClick={() => moveTopic(ch, j, -1)} className="p-1 text-ink-400 disabled:opacity-30" aria-label="Move topic up"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button type="button" disabled={!canEdit || j === ch.topics.length - 1} onClick={() => moveTopic(ch, j, 1)} className="p-1 text-ink-400 disabled:opacity-30" aria-label="Move topic down"><ArrowDown className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="min-w-0 flex-1 text-sm"><InlineName value={t.name} disabled={!canEdit} onSave={(name) => act(() => adminApi.updateTopic(t.id, { name }), 'Renamed.')} /></div>
                      <code className="hidden text-[11px] text-ink-400 md:inline">{t.id}</code>
                      <StatusBadge status={t.status} />
                      {canEdit && <StatusSelect value={t.status} onChange={(status) => act(() => adminApi.updateTopic(t.id, { status }), `Topic ${status.toLowerCase()}.`)} />}
                      {canEdit && adminApi.deleteTopic && <button type="button" onClick={() => setRemoving({ type: 'topic', id: t.id, name: t.name })} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${t.name}`}><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  ))}
                  {canEdit && <Button size="sm" variant="ghost" leftIcon={Plus} onClick={() => setAdding({ type: 'topic', chapterId: ch.id })}>Add topic</Button>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog open={Boolean(removing)} onClose={() => setRemoving(null)} onConfirm={remove} tone="danger" title={`Delete “${removing?.name}”?`}
        description={removing?.type === 'chapter' ? 'Only a chapter with no topics can be deleted. To hide it from students instead, set it to DRAFT.' : 'Only a topic with no study material can be deleted. To hide it from students instead, set it to DRAFT.'} confirmLabel="Delete"
      />
      <Modal open={Boolean(adding)} onClose={() => setAdding(null)} title={adding?.type === 'chapter' ? `New chapter · Class ${classId}` : 'New topic'} description="New items start as drafts and are hidden from students until published."
        footer={<><Button variant="outline" onClick={() => setAdding(null)}>Cancel</Button><Button disabled={newName.trim().length < 3} onClick={create}>Create</Button></>}
      >
        <TextField label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} data-autofocus />
      </Modal>
    </div>
  );
}
