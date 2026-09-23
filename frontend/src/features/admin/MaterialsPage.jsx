import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Save, Eye, Pencil, FileText, Video, History, Upload } from 'lucide-react';
import { Card, Button, TextField, TextArea, SelectField, Tabs, PageSkeleton, EmptyState, Alert } from '@/components/ui';
import { RichText } from '@/components/math/RichText';
import { useQuery } from '@/hooks/useQuery';
import { adminApi } from '@/services/api/admin';
import { errorMessage } from '@/services/errors';
import { useDocumentTitle } from '@/hooks/useCommon';
import { formatDateTime } from '@/lib/date';
import { AdminPageHeader, ClassSelect, StatusBadge, useCan, ReadOnlyNote } from './adminShared';

/** Study material manager (F12-03, F3-03/04): rich text + PDF + video link, preview, publish states, version history. */
export default function MaterialsPage() {
  useDocumentTitle('Study material');
  const canEdit = useCan('editContent');
  const [classId, setClassId] = useState(8);
  const { data: cur } = useQuery(`admin:curriculum:${classId}`, () => adminApi.curriculum(classId));
  const [chapterId, setChapterId] = useState('');
  const [topicId, setTopicId] = useState('');
  const chapter = cur?.chapters.find((c) => c.id === chapterId);

  useEffect(() => { setChapterId(''); setTopicId(''); }, [classId]);
  useEffect(() => { if (cur && !chapterId && cur.chapters[0]) { setChapterId(cur.chapters[0].id); setTopicId(cur.chapters[0].topics[0]?.id || ''); } }, [cur, chapterId]);

  const { data, loading, refetch } = useQuery(`admin:material:${topicId}`, () => adminApi.material(topicId), { enabled: Boolean(topicId), staleMs: 0 });
  const [form, setForm] = useState(null);
  const [view, setView] = useState('edit');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    const m = data.material;
    const text = m.blocks.find((b) => b.type === 'TEXT');
    const pdf = m.blocks.find((b) => b.type === 'PDF');
    const video = m.blocks.find((b) => b.type === 'VIDEO');
    setForm({ title: m.title, body: text?.body || '', pdfTitle: pdf?.title || '', pdfPages: pdf?.pages || '', videoTitle: video?.title || '', videoUrl: video?.url?.startsWith('mock://') ? '' : video?.url || '', status: m.status });
  }, [data]);

  const dirty = useMemo(() => Boolean(form), [form]);

  const save = async (status) => {
    setBusy(true);
    try {
      await adminApi.saveMaterial(topicId, {
        title: form.title, body: form.body, status: status || form.status,
        pdf: form.pdfTitle ? { title: form.pdfTitle, pages: Number(form.pdfPages) || 1 } : null,
        video: form.videoUrl ? { title: form.videoTitle, url: form.videoUrl } : null,
      });
      toast.success(status === 'PUBLISHED' ? 'Published — students see it on next open.' : 'Saved as draft.');
      refetch();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <div>
      <AdminPageHeader title="Study material" subtitle="Notes use GG-Markdown: ## heading · - bullet · > tip · >> example · $inline$ and $$display$$ LaTeX." />
      {!canEdit && <ReadOnlyNote />}
      <Card className="mb-5 grid gap-3 sm:grid-cols-3">
        <ClassSelect value={classId} onChange={setClassId} />
        <SelectField label="Chapter" value={chapterId} onChange={(e) => { setChapterId(e.target.value); setTopicId(cur.chapters.find((c) => c.id === e.target.value)?.topics[0]?.id || ''); }} options={(cur?.chapters || []).map((c) => ({ value: c.id, label: c.name }))} />
        <SelectField label="Topic" value={topicId} onChange={(e) => setTopicId(e.target.value)} options={(chapter?.topics || []).map((t) => ({ value: t.id, label: t.name }))} />
      </Card>

      {!topicId ? <EmptyState title="Choose a topic" description="Pick a class, chapter and topic to edit its material." /> : loading && !form ? <PageSkeleton rows={1} /> : form && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <Tabs value={view} onChange={setView} tabs={[{ value: 'edit', label: 'Edit', icon: Pencil }, { value: 'preview', label: 'Student preview', icon: Eye }]} />
              <div className="flex items-center gap-2"><StatusBadge status={data.material.status} /><span className="text-xs text-ink-500">v{data.material.version}</span></div>
            </div>
            {view === 'edit' ? (
              <div className="space-y-4">
                <TextField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} disabled={!canEdit} />
                <TextArea label="Notes" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={16} textareaClassName="font-mono text-sm" disabled={!canEdit} maxLength={20000} />
              </div>
            ) : (
              <div className="rounded-2xl border border-ink-100 p-5"><RichText source={form.body} /></div>
            )}
          </Card>
          <div className="space-y-4">
            <Card>
              <p className="mb-3 flex items-center gap-2 font-bold"><FileText className="h-4 w-4 text-rose-500" />PDF</p>
              <TextField label="File name" value={form.pdfTitle} onChange={(e) => setForm({ ...form, pdfTitle: e.target.value })} disabled={!canEdit} placeholder="Worksheet.pdf" />
              <TextField className="mt-3" label="Pages" type="number" min={1} value={form.pdfPages} onChange={(e) => setForm({ ...form, pdfPages: e.target.value })} disabled={!canEdit} />
              {canEdit && <Button size="sm" variant="outline" leftIcon={Upload} className="mt-3" onClick={() => toast.info('Demo: PDFs upload to the private bucket via a signed URL.')}>Upload PDF</Button>}
              <p className="mt-2 text-xs text-ink-500">Students view PDFs in-app; download is disabled.</p>
            </Card>
            <Card>
              <p className="mb-3 flex items-center gap-2 font-bold"><Video className="h-4 w-4 text-sky-500" />Video link</p>
              <TextField label="Title" value={form.videoTitle} onChange={(e) => setForm({ ...form, videoTitle: e.target.value })} disabled={!canEdit} />
              <TextField className="mt-3" label="YouTube / Vimeo URL" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} disabled={!canEdit} placeholder="https://www.youtube.com/watch?v=…" />
            </Card>
            {canEdit && (
              <div className="grid grid-cols-1 gap-2">
                <Button leftIcon={Save} variant="outline" loading={busy} disabled={!dirty} onClick={() => save('DRAFT')}>Save draft</Button>
                <Button loading={busy} onClick={() => save('PUBLISHED')}>Publish</Button>
                {data.material.status === 'PUBLISHED' && <Button variant="ghost" onClick={() => save('RETIRED')}>Retire</Button>}
              </div>
            )}
            <Card>
              <p className="mb-2 flex items-center gap-2 font-bold"><History className="h-4 w-4 text-ink-400" />Version history</p>
              {data.history.length === 0 ? <p className="text-sm text-ink-500">Only the original version exists.</p> : (
                <ul className="space-y-2 text-sm">{data.history.map((h, i) => <li key={i} className="flex justify-between gap-2"><span>v{h.version} · {h.status}</span><span className="text-xs text-ink-400">{h.updatedAt ? formatDateTime(h.updatedAt) : ''}</span></li>)}</ul>
              )}
            </Card>
            <Alert tone="info">A topic with no published material still shows practice and doubt buttons to students.</Alert>
          </div>
        </div>
      )}
    </div>
  );
}
