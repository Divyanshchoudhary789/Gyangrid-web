import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, TextField, SelectField, Tabs, PageSkeleton, ErrorState, DifficultyBadge, Card } from '@/components/ui';
import { MathText } from '@/components/math/MathText';
import { useQuery } from '@/hooks/useQuery';
import { adminApi } from '@/services/api/admin';
import { useDebounced, useDocumentTitle } from '@/hooks/useCommon';
import { AdminPageHeader, AdminTable, ClassSelect, StatusBadge, useCan } from './adminShared';

/** Question manager (F12-04): filter by class / chapter / topic / difficulty / status, review queue, stats. */
export default function QuestionsPage() {
  useDocumentTitle('Question bank');
  const navigate = useNavigate();
  const canEdit = useCan('editContent');
  const [tab, setTab] = useState('ALL');
  const [f, setF] = useState({ classId: 8, chapterId: '', topicId: '', difficulty: '', status: '', source: '', page: 1 });
  const [search, setSearch] = useState('');
  const q = useDebounced(search, 300);
  const { data: cur } = useQuery(`admin:curriculum:${f.classId}`, () => adminApi.curriculum(f.classId));
  const params = useMemo(() => ({ ...f, status: tab === 'REVIEW' ? 'IN_REVIEW' : f.status, q, pageSize: 15 }), [f, tab, q]);
  const { data, error, loading, refetch } = useQuery(`admin:questions:${JSON.stringify(params)}`, () => adminApi.questions(params), { staleMs: 0 });
  const chapter = cur?.chapters.find((c) => c.id === f.chapterId);
  const set = (patch) => setF((x) => ({ ...x, page: 1, ...patch }));
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <AdminPageHeader
        title="Question bank"
        subtitle="Only APPROVED questions are served to students. Approval requires a step-by-step explanation."
        action={canEdit && (<><Button variant="outline" leftIcon={Upload} onClick={() => navigate('/admin/questions/import')}>Bulk import</Button><Button leftIcon={Plus} onClick={() => navigate('/admin/questions/new')}>New question</Button></>)}
      />
      <Tabs className="mb-4" value={tab} onChange={(t) => { setTab(t); set({}); }} tabs={[{ value: 'ALL', label: 'All questions' }, { value: 'REVIEW', label: 'Review queue' }]} />
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6 sm:p-4">
        <ClassSelect value={f.classId} onChange={(classId) => set({ classId, chapterId: '', topicId: '' })} />
        <SelectField label="Chapter" value={f.chapterId} placeholder="All" onChange={(e) => set({ chapterId: e.target.value, topicId: '' })} options={(cur?.chapters || []).map((c) => ({ value: c.id, label: c.name }))} />
        <SelectField label="Topic" value={f.topicId} placeholder="All" onChange={(e) => set({ topicId: e.target.value })} options={(chapter?.topics || []).map((t) => ({ value: t.id, label: t.name }))} disabled={!chapter} />
        <SelectField label="Difficulty" value={f.difficulty} placeholder="All" onChange={(e) => set({ difficulty: e.target.value })} options={['EASY', 'MEDIUM', 'HARD'].map((d) => ({ value: d, label: d }))} />
        {tab === 'ALL' ? <SelectField label="Status" value={f.status} placeholder="All" onChange={(e) => set({ status: e.target.value })} options={['DRAFT', 'IN_REVIEW', 'APPROVED', 'RETIRED'].map((d) => ({ value: d, label: d.replace('_', ' ') }))} /> : <div />}
        <SelectField label="Source" value={f.source} placeholder="All" onChange={(e) => set({ source: e.target.value })} options={['CLIENT_APPROVED', 'AI_GENERATED', 'IMPORTED'].map((d) => ({ value: d, label: d.replace('_', ' ') }))} />
        <TextField className="sm:col-span-2 lg:col-span-6" icon={Search} placeholder="Search by ID or text…" value={search} onChange={(e) => { setSearch(e.target.value); set({}); }} aria-label="Search questions" />
      </Card>
      {loading && !data ? <PageSkeleton rows={1} /> : !data ? <ErrorState error={error} onRetry={refetch} /> : (
        <>
          <AdminTable
            rowKey={(r) => r.questionId}
            onRowClick={(r) => navigate(`/admin/questions/${encodeURIComponent(r.questionId)}`)}
            empty={tab === 'REVIEW' ? 'The review queue is empty.' : 'No questions match these filters.'}
            rows={data.items}
            columns={[
              { key: 'id', label: 'ID', className: 'whitespace-nowrap font-mono text-xs text-ink-500', render: (r) => r.questionId },
              { key: 'text', label: 'Question', className: 'max-w-md', render: (r) => <MathText text={r.questionText} className="line-clamp-2 text-ink-800" /> },
              { key: 'topic', label: 'Topic', className: 'text-xs text-ink-500', render: (r) => r.topicName },
              { key: 'type', label: 'Type', className: 'text-xs', render: (r) => (r.type === 'NUMERIC' ? 'Numeric' : 'MCQ') },
              { key: 'diff', label: 'Level', render: (r) => <DifficultyBadge level={r.difficulty} /> },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              { key: 'stats', label: 'Correct %', className: 'text-right', render: (r) => (r.stats?.attempts ? `${Math.round((r.stats.correct / r.stats.attempts) * 100)}% · ${r.stats.attempts}` : '—') },
            ]}
          />
          <div className="mt-4 flex items-center justify-between text-sm text-ink-500">
            <span>{data.total} questions</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" leftIcon={ChevronLeft} disabled={f.page <= 1} onClick={() => setF((x) => ({ ...x, page: x.page - 1 }))}>Prev</Button>
              <span>Page {f.page} / {pages}</span>
              <Button size="sm" variant="outline" rightIcon={ChevronRight} disabled={f.page >= pages} onClick={() => setF((x) => ({ ...x, page: x.page + 1 }))}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
