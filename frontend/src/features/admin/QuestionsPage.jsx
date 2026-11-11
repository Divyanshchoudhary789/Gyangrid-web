import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Upload, Search, ChevronLeft, ChevronRight,
  Tag, X, BookOpen, ClipboardList, CheckCircle2, Hash,
} from 'lucide-react';
import { Button, TextField, SelectField, Tabs, PageSkeleton, ErrorState, DifficultyBadge, Card } from '@/components/ui';
import { MathText } from '@/components/math/MathText';
import { useQuery } from '@/hooks/useQuery';
import { adminApi } from '@/services/api/admin';
import { useDebounced, useDocumentTitle } from '@/hooks/useCommon';
import { AdminPageHeader, AdminTable, ClassSelect, StatusBadge, useCan, ADMIN_CAPS, supports } from './adminShared';
import { cn } from '@/lib/cn';

const TYPE_LABEL = { MCQ_SINGLE: 'MCQ', TRUE_FALSE: 'True / False', NUMERIC: ADMIN_CAPS ? 'Short answer' : 'Numeric' };
const STATUS_OPTIONS = supports('reviewQueue') ? ['DRAFT', 'IN_REVIEW', 'APPROVED', 'RETIRED'] : ['DRAFT', 'APPROVED', 'RETIRED'];
const statusLabel = (s) => (ADMIN_CAPS && s === 'APPROVED' ? 'Published' : s.replace('_', ' '));

/* ─── Type pill badge ─────────────────────────────────────────────────────── */

const TYPE_STYLES = {
  MCQ_SINGLE: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  TRUE_FALSE:  'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  NUMERIC:     'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
};

function TypePill({ type }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', TYPE_STYLES[type] || 'bg-ink-100 text-ink-600')}>
      {TYPE_LABEL[type] || type}
    </span>
  );
}

/* ─── Correct % mini progress bar ────────────────────────────────────────── */

function CorrectPct({ stats }) {
  if (!stats?.attempts) return <span className="text-ink-300 text-xs">—</span>;
  const pct = Math.round((stats.correct / stats.attempts) * 100);
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-1.5 min-w-[72px]">
      <div className="relative h-1.5 w-12 overflow-hidden rounded-full bg-ink-100">
        <div className={cn('absolute inset-y-0 left-0 rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-ink-600 tabular-nums">{pct}%</span>
    </div>
  );
}

/* ─── Status cell: PUBLISHED → "Live" with green dot ─────────────────────── */

function StatusCell({ status }) {
  const displayStatus = ADMIN_CAPS && status === 'APPROVED' ? 'PUBLISHED' : status;
  if (displayStatus === 'PUBLISHED') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
        Live
      </span>
    );
  }
  return <StatusBadge status={displayStatus} />;
}

/* ─── Quick Stats KPI tile ────────────────────────────────────────────────── */

function KpiTile({ icon: Icon, label, value, tone = 'brand', loading }) {
  const toneMap = {
    brand:   { ring: 'bg-brand-100',   icon: 'text-brand-600',   border: 'border-brand-100' },
    success: { ring: 'bg-emerald-100', icon: 'text-emerald-600', border: 'border-emerald-100' },
    warning: { ring: 'bg-amber-100',   icon: 'text-amber-600',   border: 'border-amber-100' },
    info:    { ring: 'bg-sky-100',     icon: 'text-sky-600',     border: 'border-sky-100' },
  };
  const s = toneMap[tone] || toneMap.brand;

  return (
    <div className={cn('flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-card', s.border)}>
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', s.ring)}>
        <Icon className={cn('h-5 w-5', s.icon)} aria-hidden="true" />
      </div>
      <div>
        {loading ? (
          <div className="h-6 w-16 animate-pulse rounded bg-ink-100" />
        ) : (
          <p className="text-xl font-bold font-display text-ink-900 leading-none">{value ?? '—'}</p>
        )}
        <p className="mt-0.5 text-xs font-medium text-ink-500">{label}</p>
      </div>
    </div>
  );
}

/* ─── Active filter chip ──────────────────────────────────────────────────── */

function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-200 text-brand-600 hover:bg-brand-300 transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-2.5 w-2.5" aria-hidden="true" />
      </button>
    </span>
  );
}

/* ─── Empty states ────────────────────────────────────────────────────────── */

function EmptyFilters() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-ink-50">
        <Search className="h-9 w-9 text-ink-300" aria-hidden="true" />
      </div>
      <div>
        <p className="text-lg font-semibold text-ink-700">No questions found</p>
        <p className="mt-1 text-sm text-ink-400 max-w-xs">
          No questions match your current filters. Try adjusting or clearing some filters to see more results.
        </p>
      </div>
    </div>
  );
}

function EmptyReviewQueue() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-4xl">
        🎉
      </div>
      <div>
        <p className="text-lg font-semibold text-emerald-700">Review queue is clear!</p>
        <p className="mt-1 text-sm text-ink-400">
          All questions have been reviewed. Great work keeping the queue clean!
        </p>
      </div>
    </div>
  );
}

/* ─── Polished Pagination ─────────────────────────────────────────────────── */

function Pagination({ page, pages, total, pageSize, onPrev, onNext }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-ink-500">
        Showing <span className="font-semibold text-ink-700">{from}–{to}</span> of{' '}
        <span className="font-semibold text-ink-700">{total}</span> questions
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          leftIcon={ChevronLeft}
          disabled={page <= 1}
          onClick={onPrev}
          aria-label="Previous page"
        >
          Prev
        </Button>
        <span className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 shadow-sm">
          Page {page} of {pages}
        </span>
        <Button
          size="sm"
          variant="outline"
          rightIcon={ChevronRight}
          disabled={page >= pages}
          onClick={onNext}
          aria-label="Next page"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/* ─── QuestionsPage ───────────────────────────────────────────────────────── */

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

  /* Derive quick-stats from available data */
  const totalQ = data?.total ?? null;
  const reviewCount = supports('reviewQueue') ? (tab === 'REVIEW' ? data?.total ?? null : null) : null;
  const publishedCount = ADMIN_CAPS ? null : null; // only derivable from a separate query; show skeleton

  /* Active filter chips */
  const activeChips = [];
  if (f.chapterId && cur) {
    const ch = cur.chapters.find((c) => c.id === f.chapterId);
    if (ch) activeChips.push({ key: 'chapterId', label: `Chapter: ${ch.name}`, clear: () => set({ chapterId: '', topicId: '' }) });
  }
  if (f.topicId && chapter) {
    const tp = chapter.topics?.find((t) => t.id === f.topicId);
    if (tp) activeChips.push({ key: 'topicId', label: `Topic: ${tp.name}`, clear: () => set({ topicId: '' }) });
  }
  if (f.difficulty) activeChips.push({ key: 'difficulty', label: `Difficulty: ${f.difficulty}`, clear: () => set({ difficulty: '' }) });
  if (f.status && tab === 'ALL') activeChips.push({ key: 'status', label: `Status: ${statusLabel(f.status)}`, clear: () => set({ status: '' }) });
  if (f.source) activeChips.push({ key: 'source', label: `Source: ${f.source.replace(/_/g, ' ')}`, clear: () => set({ source: '' }) });
  if (search) activeChips.push({ key: 'search', label: `Search: "${search}"`, clear: () => { setSearch(''); set({}); } });

  /* Tab definitions with optional red badge */
  const tabItems = [
    { value: 'ALL', label: 'All Questions' },
    ...(supports('reviewQueue') ? [{
      value: 'REVIEW',
      label: (
        <span className="inline-flex items-center gap-1.5">
          Review Queue
          {tab === 'REVIEW' && data?.total > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {data.total}
            </span>
          )}
        </span>
      ),
    }] : []),
  ];

  /* Columns */
  const columns = [
    {
      key: 'id',
      label: 'ID',
      className: 'whitespace-nowrap',
      render: (r) => (
        <span className="font-mono text-xs text-ink-400">
          {ADMIN_CAPS ? `…${String(r.questionId).slice(-6)}` : r.questionId}
        </span>
      ),
    },
    {
      key: 'text',
      label: 'Question',
      className: 'max-w-sm',
      render: (r) => (
        <MathText text={r.questionText} className="line-clamp-2 text-sm text-ink-800 leading-snug" />
      ),
    },
    {
      key: 'topic',
      label: 'Topic',
      render: (r) => r.topicName ? (
        <span className="inline-flex items-center gap-1 text-xs text-ink-500">
          <Tag className="h-3 w-3 shrink-0 text-ink-300" aria-hidden="true" />
          {r.topicName}
        </span>
      ) : <span className="text-ink-300 text-xs">—</span>,
    },
    {
      key: 'type',
      label: 'Type',
      render: (r) => <TypePill type={r.type} />,
    },
    {
      key: 'diff',
      label: 'Level',
      render: (r) => <DifficultyBadge level={r.difficulty} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusCell status={r.status} />,
    },
    ...(ADMIN_CAPS
      ? []
      : [{
          key: 'stats',
          label: 'Correct %',
          className: 'text-right',
          render: (r) => <CorrectPct stats={r.stats} />,
        }]),
  ];

  return (
    <div>
      <AdminPageHeader
        title="Question bank"
        subtitle={
          ADMIN_CAPS
            ? 'Only published questions are served to students. Publishing requires an explanation.'
            : 'Only APPROVED questions are served to students. Approval requires a step-by-step explanation.'
        }
        action={
          canEdit && (
            <>
              <Button variant="outline" leftIcon={Upload} onClick={() => navigate('/admin/questions/import')}>
                Bulk import
              </Button>
              <Button leftIcon={Plus} onClick={() => navigate('/admin/questions/new')}>
                New question
              </Button>
            </>
          )
        }
      />

      {/* ── Quick Stats ─────────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiTile
          icon={BookOpen}
          label="Total in bank"
          value={totalQ !== null ? totalQ.toLocaleString() : undefined}
          tone="brand"
          loading={loading && !data}
        />
        {supports('reviewQueue') && (
          <KpiTile
            icon={ClipboardList}
            label="In review queue"
            value={reviewCount !== null ? reviewCount.toLocaleString() : '—'}
            tone="warning"
            loading={loading && !data}
          />
        )}
        <KpiTile
          icon={CheckCircle2}
          label={ADMIN_CAPS ? 'Published' : 'Approved'}
          value={publishedCount !== null ? publishedCount.toLocaleString() : '—'}
          tone="success"
          loading={loading && !data}
        />
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      {supports('reviewQueue') && (
        <Tabs
          className="mb-4"
          value={tab}
          onChange={(t) => { setTab(t); set({}); }}
          tabs={tabItems}
        />
      )}

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <ClassSelect value={f.classId} onChange={(classId) => set({ classId, chapterId: '', topicId: '' })} />
          <SelectField
            label="Chapter"
            value={f.chapterId}
            placeholder="All"
            onChange={(e) => set({ chapterId: e.target.value, topicId: '' })}
            options={(cur?.chapters || []).map((c) => ({ value: c.id, label: c.name }))}
          />
          <SelectField
            label="Topic"
            value={f.topicId}
            placeholder="All"
            onChange={(e) => set({ topicId: e.target.value })}
            options={(chapter?.topics || []).map((t) => ({ value: t.id, label: t.name }))}
            disabled={!chapter}
          />
          <SelectField
            label="Difficulty"
            value={f.difficulty}
            placeholder="All"
            onChange={(e) => set({ difficulty: e.target.value })}
            options={['EASY', 'MEDIUM', 'HARD'].map((d) => ({ value: d, label: d }))}
          />
          {tab === 'ALL' ? (
            <SelectField
              label="Status"
              value={f.status}
              placeholder="All"
              onChange={(e) => set({ status: e.target.value })}
              options={STATUS_OPTIONS.map((d) => ({ value: d, label: statusLabel(d) }))}
            />
          ) : (
            <div />
          )}
          {supports('questionSource') && (
            <SelectField
              label="Source"
              value={f.source}
              placeholder="All"
              onChange={(e) => set({ source: e.target.value })}
              options={['CLIENT_APPROVED', 'AI_GENERATED', 'IMPORTED'].map((d) => ({ value: d, label: d.replace('_', ' ') }))}
            />
          )}

          {/* Search bar — full width with ⌘K hint */}
          <div className="relative sm:col-span-2 lg:col-span-6">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); set({}); }}
              placeholder="Search by ID or text…"
              className="input h-10 w-full rounded-xl border border-ink-200 bg-white py-2 pl-9 pr-20 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 transition-shadow"
              aria-label="Search questions"
            />
            {/* Keyboard shortcut hint */}
            {!search && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5">
                <kbd className="inline-flex h-5 items-center rounded border border-ink-200 bg-ink-100 px-1.5 font-mono text-[10px] text-ink-500">
                  ⌘K
                </kbd>
              </span>
            )}
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); set({}); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-ink-200 text-ink-500 hover:bg-ink-300 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Active filter chips + count */}
        {(activeChips.length > 0 || (data && data.total !== undefined)) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {activeChips.map((chip) => (
              <FilterChip key={chip.key} label={chip.label} onRemove={chip.clear} />
            ))}
            {activeChips.length > 0 && (
              <button
                type="button"
                onClick={() => { setSearch(''); setF({ classId: 8, chapterId: '', topicId: '', difficulty: '', status: '', source: '', page: 1 }); }}
                className="text-xs text-ink-400 underline underline-offset-2 hover:text-ink-700 transition-colors"
              >
                Clear all
              </button>
            )}
            {data && (
              <span className="ml-auto flex items-center gap-1 text-xs font-medium text-ink-500">
                <Hash className="h-3 w-3" aria-hidden="true" />
                {data.total.toLocaleString()} question{data.total !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </Card>

      {/* ── Table / Loading / Error ──────────────────────────────────────── */}
      {loading && !data ? (
        <PageSkeleton rows={1} />
      ) : !data ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          <AdminTable
            rowKey={(r) => r.questionId}
            onRowClick={(r) => navigate(`/admin/questions/${encodeURIComponent(r.questionId)}`)}
            rows={data.items}
            columns={columns}
            loading={loading}
            empty={tab === 'REVIEW' ? '' : ''}
            emptyMessage={
              tab === 'REVIEW' ? (
                <EmptyReviewQueue />
              ) : (
                <EmptyFilters />
              )
            }
          />

          {/* ── Pagination ────────────────────────────────────────────── */}
          {data.total > 0 && (
            <Pagination
              page={f.page}
              pages={pages}
              total={data.total}
              pageSize={data.pageSize || 15}
              onPrev={() => setF((x) => ({ ...x, page: x.page - 1 }))}
              onNext={() => setF((x) => ({ ...x, page: x.page + 1 }))}
            />
          )}
        </>
      )}
    </div>
  );
}
