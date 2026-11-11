import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload, RefreshCw, Trash2, Database, LoaderCircle, FileText, CheckCircle2, AlertTriangle, Search, Info, ShieldCheck } from 'lucide-react';
import { Button, PageSkeleton, ErrorState, Card, Stat, Alert, Modal, TextField, TextArea } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { useInterval, useDocumentTitle, useDebounced } from '@/hooks/useCommon';
import { ComingSoon } from '@/components/feedback/ComingSoon';
import { adminApi } from '@/services/api/admin';
import { ERROR_CODES, errorMessage } from '@/services/errors';
import { formatDateTime, timeAgo } from '@/lib/date';
import { formatNumber } from '@/lib/format';
import { AdminPageHeader, AdminTable, StatusBadge, supports, ADMIN_CAPS } from './adminShared';
import { cn } from '@/lib/cn';

/** AI knowledge base manager: upload approved docs, trigger indexing, view status, remove. */
function KnowledgeBasePageFull() {
  useDocumentTitle('AI knowledge base');
  const fileRef = useRef(null);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const q = useDebounced(search, 300);

  const { data, error, loading, refetch } = useQuery('admin:kb', adminApi.kb, { staleMs: 0 });
  const indexing = data?.docs?.some((d) => d.status === 'INDEXING');
  useInterval(refetch, indexing ? 15000 : null);

  const act = async (fn, msg) => {
    try {
      await fn();
      toast.success(msg);
      refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const upload = (file) => {
    if (!file) return;
    act(() => adminApi.uploadKb({ name: file.name, sizeKb: Math.max(1, Math.round(file.size / 1024)) }), 'Uploaded — indexing started.');
    if (fileRef.current) fileRef.current.value = '';
  };

  if (loading && !data) return <PageSkeleton rows={1} />;
  if (!data) return <ErrorState error={error} onRetry={refetch} />;

  const filteredDocs = q
    ? data.docs.filter((d) => d.name.toLowerCase().includes(q.toLowerCase()) || d.description?.toLowerCase().includes(q.toLowerCase()))
    : data.docs;

  const totalChunks = data.vectorStore?.totalChunks ?? data.docs.reduce((sum, d) => sum + (d.chunks || 0), 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="AI Tutor Knowledge Base"
        subtitle="Manage official syllabus textbooks and verified materials that ground the AI tutor's answers."
        action={
          <Button variant="brand" leftIcon={Upload} onClick={() => (ADMIN_CAPS ? setAddOpen(true) : fileRef.current?.click())}>
            Add Document
          </Button>
        }
      />

      <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />

      {/* KPI Stats overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card transition hover:shadow-lift">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Database className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Total Documents</p>
              <p className="font-display text-2xl font-bold text-ink-900">{formatNumber(data.docs.length)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card transition hover:shadow-lift">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Indexed Chunks</p>
              <p className="font-display text-2xl font-bold text-ink-900">{formatNumber(totalChunks)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card transition hover:shadow-lift">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <RefreshCw className={cn("h-6 w-6", indexing && "animate-spin")} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Last Synced</p>
              <p className="font-display text-base font-bold text-ink-900">
                {data.vectorStore?.lastSyncAt ? timeAgo(data.vectorStore.lastSyncAt) : 'Ready'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Security and privacy info banner */}
      <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/40 p-4 text-sm text-brand-950">
        <Info className="h-5 w-5 shrink-0 text-brand-600" />
        <p className="text-xs sm:text-sm text-ink-700">
          All document embeddings and vector store credentials reside securely on the backend server. The AI tutor only references verified documents uploaded here to prevent hallucinations.
        </p>
      </div>

      {/* Search filter card */}
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder="Search documents by title or topic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <span className="text-xs font-semibold text-ink-500">{filteredDocs.length} documents total</span>
      </Card>

      {/* Documents Table */}
      <AdminTable
        rowKey={(d) => d.id}
        rows={filteredDocs}
        empty="No documents found matching your search."
        columns={[
          {
            key: 'name',
            label: 'Document',
            className: 'font-semibold',
            render: (d) => (
              <div className="flex items-center gap-3 py-1">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink-900">{d.name}</p>
                  {d.description && <p className="truncate text-xs text-ink-400 max-w-xs">{d.description}</p>}
                  {d.error && <p className="text-xs font-medium text-rose-600 mt-0.5">{d.error}</p>}
                </div>
              </div>
            ),
          },
          ...(ADMIN_CAPS
            ? []
            : [
                { key: 'class', label: 'Class', render: (d) => (d.classId ? `Class ${d.classId}` : 'All Classes') },
                { key: 'size', label: 'Size', render: (d) => `${formatNumber(d.sizeKb)} KB` },
              ]),
          {
            key: 'status',
            label: 'Indexing Status',
            render: (d) =>
              d.status === 'INDEXING' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin text-sky-600" />
                  Indexing...
                </span>
              ) : d.status === 'INDEXED' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Indexed
                </span>
              ) : (
                <StatusBadge status={d.status} />
              ),
          },
          {
            key: 'chunks',
            label: 'Vectors',
            className: 'text-xs text-ink-600 font-mono',
            render: (d) => `${formatNumber(d.chunks)} chunks`,
          },
          {
            key: 'sync',
            label: 'Last Synced',
            className: 'text-xs text-ink-500',
            render: (d) => (d.lastSyncAt ? formatDateTime(d.lastSyncAt) : 'Pending'),
          },
          {
            key: 'actions',
            label: '',
            render: (d) => (
              <div className="flex justify-end gap-1.5">
                <Button
                  size="xs"
                  variant="outline"
                  leftIcon={RefreshCw}
                  disabled={d.status === 'INDEXING'}
                  onClick={() => act(() => adminApi.reindexKb(d.id), 'Re-indexing initiated.')}
                >
                  Re-index
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  leftIcon={Trash2}
                  className="text-rose-600 hover:bg-rose-50"
                  onClick={() => act(() => adminApi.removeKb(d.id), 'Removed from knowledge base.')}
                >
                  Remove
                </Button>
              </div>
            ),
          },
        ]}
      />

      {addOpen && <AddDocument onClose={() => setAddOpen(false)} onAdded={refetch} />}
    </div>
  );
}

/** Add document modal with drag-drop style visual zone */
function AddDocument({ onClose, onAdded }) {
  const [f, setF] = useState({ title: '', description: '', sourceUrl: '', file: null });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await adminApi.createKbDoc(f);
      toast.success('Document added! Vector indexing has begun in the background.');
      onAdded();
      onClose();
    } catch (e) {
      toast.error(
        e.code === ERROR_CODES.SERVICE_UNAVAILABLE
          ? 'Cloud storage is not configured yet. Paste an https URL instead.'
          : errorMessage(e)
      );
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add Document to Knowledge Base"
      description="Upload official textbooks or verified supplementary notes to expand the AI tutor's reference material."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="brand"
            loading={busy}
            disabled={f.title.trim().length < 3 || (!f.file && !f.sourceUrl.trim())}
            onClick={save}
          >
            Add &amp; Begin Indexing
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField
          label="Document Title"
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          placeholder="e.g. NCERT Mathematics Class 8 Chapter 1"
          required
          data-autofocus
        />
        <TextArea
          label="Description / Context (optional)"
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
          placeholder="Brief description of chapters or syllabus topics covered..."
          rows={2}
          maxLength={1000}
        />

        {/* Upload box or link */}
        <div className="rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/50 p-5 text-center transition hover:border-brand-300 hover:bg-brand-50/20">
          <Upload className="mx-auto h-8 w-8 text-brand-500 mb-2" />
          <p className="text-sm font-bold text-ink-800">Upload PDF File</p>
          <p className="text-xs text-ink-500 mt-0.5">Maximum file size: 20 MB</p>
          <input
            type="file"
            accept="application/pdf"
            className="mt-3 block w-full text-xs text-ink-500 file:mr-3 file:rounded-xl file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
            onChange={(e) => setF({ ...f, file: e.target.files?.[0] || null })}
          />
          {f.file && (
            <p className="mt-2 text-xs font-semibold text-emerald-700 flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Selected: {f.file.name}
            </p>
          )}
        </div>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-ink-200 w-full" />
          <span className="bg-white px-3 text-xs uppercase text-ink-400 font-semibold absolute">OR</span>
        </div>

        <TextField
          label="Hosted HTTPS Link"
          value={f.sourceUrl}
          disabled={Boolean(f.file)}
          onChange={(e) => setF({ ...f, sourceUrl: e.target.value })}
          placeholder="https://example.com/books/ncert-math-class-8.pdf"
          hint="If already hosted on cloud storage, paste the secure link directly."
        />
      </div>
    </Modal>
  );
}

export default function KnowledgeBasePage() {
  if (!supports('kb')) {
    return (
      <ComingSoon
        title="AI Knowledge Base"
        subtitle="The backend knowledge base endpoints are not enabled yet."
        emoji="📚"
        points={['Upload approved PDFs and textbook chapters', 'Vector chunking and indexing status', 'Automated tutor grounding', 'Index synchronization']}
        primary={{ to: '/admin', label: 'Back to Dashboard' }}
      />
    );
  }
  return <KnowledgeBasePageFull />;
}
