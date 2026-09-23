import { useRef } from 'react';
import { toast } from 'sonner';
import { Upload, RefreshCw, Trash2, Database, LoaderCircle } from 'lucide-react';
import { Button, PageSkeleton, ErrorState, Stat, Alert } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { useInterval, useDocumentTitle } from '@/hooks/useCommon';
import { adminApi } from '@/services/api/admin';
import { errorMessage } from '@/services/errors';
import { formatDateTime, timeAgo } from '@/lib/date';
import { formatNumber } from '@/lib/format';
import { AdminPageHeader, AdminTable, StatusBadge } from './adminShared';

/** AI knowledge base manager (F12-06): upload approved docs, trigger indexing, view status, remove. */
export default function KnowledgeBasePage() {
  useDocumentTitle('AI knowledge base');
  const fileRef = useRef(null);
  const { data, error, loading, refetch } = useQuery('admin:kb', adminApi.kb, { staleMs: 0 });
  const indexing = data?.docs.some((d) => d.status === 'INDEXING');
  useInterval(refetch, indexing ? 2000 : null);

  const act = async (fn, msg) => { try { await fn(); toast.success(msg); refetch(); } catch (e) { toast.error(errorMessage(e)); } };
  const upload = (file) => {
    if (!file) return;
    act(() => adminApi.uploadKb({ name: file.name, sizeKb: Math.max(1, Math.round(file.size / 1024)) }), 'Uploaded — indexing started.');
  };

  if (loading && !data) return <PageSkeleton rows={1} />;
  if (!data) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <AdminPageHeader title="AI knowledge base" subtitle="Only approved documents are indexed. The tutor's answers are grounded in this content." action={<Button leftIcon={Upload} onClick={() => fileRef.current?.click()}>Upload document</Button>} />
      <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat icon={Database} label="Vector store" value={data.vectorStore.id} hint="ID stays server-side" />
        <Stat icon={Database} tone="success" label="Indexed chunks" value={formatNumber(data.vectorStore.totalChunks)} />
        <Stat icon={RefreshCw} tone="info" label="Last sync" value={data.vectorStore.lastSyncAt ? timeAgo(data.vectorStore.lastSyncAt) : '—'} />
      </div>
      <Alert tone="info" className="mb-4">Provider keys and the vector store live only on the server. This console triggers indexing through the backend.</Alert>
      <AdminTable
        rowKey={(d) => d.id}
        rows={data.docs}
        columns={[
          { key: 'name', label: 'Document', className: 'font-semibold', render: (d) => <span>{d.name}{d.error && <span className="block text-xs font-normal text-rose-600">{d.error}</span>}</span> },
          { key: 'class', label: 'Class', render: (d) => (d.classId ? `Class ${d.classId}` : 'All') },
          { key: 'size', label: 'Size', render: (d) => `${formatNumber(d.sizeKb)} KB` },
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
    </div>
  );
}
