import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload, RefreshCw, Trash2, Database, LoaderCircle } from 'lucide-react';
import { Button, PageSkeleton, ErrorState, Stat, Alert, Modal, TextField, TextArea } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { useInterval, useDocumentTitle } from '@/hooks/useCommon';
import { ComingSoon } from '@/components/feedback/ComingSoon';
import { adminApi } from '@/services/api/admin';
import { ERROR_CODES, errorMessage } from '@/services/errors';
import { formatDateTime, timeAgo } from '@/lib/date';
import { formatNumber } from '@/lib/format';
import { AdminPageHeader, AdminTable, StatusBadge, supports, ADMIN_CAPS } from './adminShared';

/** AI knowledge base manager (F12-06): upload approved docs, trigger indexing, view status, remove. */
function KnowledgeBasePageFull() {
  useDocumentTitle('AI knowledge base');
  const fileRef = useRef(null);
  const [addOpen, setAddOpen] = useState(false);
  const { data, error, loading, refetch } = useQuery('admin:kb', adminApi.kb, { staleMs: 0 });
  const indexing = data?.docs.some((d) => d.status === 'INDEXING');
  useInterval(refetch, indexing ? 15000 : null); // indexing runs for minutes

  const act = async (fn, msg) => { try { await fn(); toast.success(msg); refetch(); } catch (e) { toast.error(errorMessage(e)); } };
  const upload = (file) => {
    if (!file) return;
    act(() => adminApi.uploadKb({ name: file.name, sizeKb: Math.max(1, Math.round(file.size / 1024)) }), 'Uploaded — indexing started.');
    if (fileRef.current) fileRef.current.value = '';
  };

  if (loading && !data) return <PageSkeleton rows={1} />;
  if (!data) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <AdminPageHeader title="AI knowledge base" subtitle="Only approved documents are indexed. The tutor's answers are grounded in this content." action={<Button leftIcon={Upload} onClick={() => (ADMIN_CAPS ? setAddOpen(true) : fileRef.current?.click())}>Add document</Button>} />
      <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {ADMIN_CAPS ? <Stat icon={Database} label="Documents" value={formatNumber(data.docs.length)} /> : <Stat icon={Database} label="Vector store" value={data.vectorStore.id} hint="ID stays server-side" />}
        <Stat icon={Database} tone="success" label="Indexed chunks" value={formatNumber(data.vectorStore.totalChunks)} />
        <Stat icon={RefreshCw} tone="info" label="Last sync" value={data.vectorStore.lastSyncAt ? timeAgo(data.vectorStore.lastSyncAt) : '—'} />
      </div>
      <Alert tone="info" className="mb-4">Provider keys and the vector store live only on the server. This console triggers indexing through the backend.</Alert>
      <AdminTable
        rowKey={(d) => d.id}
        rows={data.docs}
        columns={[
          { key: 'name', label: 'Document', className: 'font-semibold', render: (d) => <span>{d.name}{d.error && <span className="block text-xs font-normal text-rose-600">{d.error}</span>}</span> },
          ...(ADMIN_CAPS ? [] : [
            { key: 'class', label: 'Class', render: (d) => (d.classId ? `Class ${d.classId}` : 'All') },
            { key: 'size', label: 'Size', render: (d) => `${formatNumber(d.sizeKb)} KB` },
          ]),
          { key: 'status', label: 'Status', render: (d) => (d.status === 'INDEXING' ? <span className="flex items-center gap-1.5 text-sm text-sky-600"><LoaderCircle className="h-4 w-4 animate-spin" />Indexing</span> : <StatusBadge status={d.status} />) },
          { key: 'chunks', label: 'Chunks', render: (d) => formatNumber(d.chunks) },
          { key: 'sync', label: 'Last sync', className: 'text-xs text-ink-500', render: (d) => (d.lastSyncAt ? formatDateTime(d.lastSyncAt) : '—') },
          {
            key: 'actions', label: '', render: (d) => (
              <div className="flex justify-end gap-1">
                <Button size="xs" variant="ghost" leftIcon={RefreshCw} disabled={d.status === 'INDEXING'} onClick={() => act(() => adminApi.reindexKb(d.id), 'Re-index started.')}>Re-index</Button>
                <Button size="xs" variant="ghost" leftIcon={Trash2} className="text-rose-600" onClick={() => act(() => adminApi.removeKb(d.id), 'Removed from index.')}>Remove</Button>
              </div>
            ),
          },
        ]}
      />
      {addOpen && <AddDocument onClose={() => setAddOpen(false)} onAdded={refetch} />}
    </div>
  );
}

/** Live backend: a document is a title plus a PDF, either uploaded here or linked over https. */
function AddDocument({ onClose, onAdded }) {
  const [f, setF] = useState({ title: '', description: '', sourceUrl: '', file: null });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await adminApi.createKbDoc(f);
      toast.success('Added — indexing started.');
      onAdded();
      onClose();
    } catch (e) {
      toast.error(e.code === ERROR_CODES.SERVICE_UNAVAILABLE ? 'File storage isn\u2019t set up on the server yet. Paste an https link instead.' : errorMessage(e));
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Add a document" description="Only approved material should go in. The tutor's answers are grounded in it."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={f.title.trim().length < 3 || (!f.file && !f.sourceUrl.trim())} onClick={save}>Add document</Button></>}
    >
      <div className="space-y-3">
        <TextField label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} data-autofocus />
        <TextArea label="Description (optional)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} maxLength={1000} />
        <TextField label="PDF link (https)" value={f.sourceUrl} disabled={Boolean(f.file)} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} placeholder="https://…/ncert-class-6.pdf" />
        <div>
          <p className="label">Or upload a PDF (max 20 MB)</p>
          <input type="file" accept="application/pdf" aria-label="Upload a PDF" className="block w-full text-sm" onChange={(e) => setF({ ...f, file: e.target.files?.[0] || null })} />
        </div>
      </div>
    </Modal>
  );
}

export default function KnowledgeBasePage() {
  if (!supports('kb')) {
    return <ComingSoon title="AI knowledge base" subtitle="The backend has no knowledge-base endpoints yet." emoji="📚" points={['Upload approved PDFs / DOCX', 'Indexing status per document', 'Re-index and remove', 'Vector store summary']} primary={{ to: '/admin', label: 'Back to dashboard' }} />;
  }
  return <KnowledgeBasePageFull />;
}
