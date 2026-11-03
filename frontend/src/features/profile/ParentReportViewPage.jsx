import { useSearchParams } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { Button, Card, PageSkeleton } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { progressApi } from '@/services/api/student';
import { ERROR_CODES, errorMessage } from '@/services/errors';
import { useDocumentTitle } from '@/hooks/useCommon';
import { formatDate } from '@/lib/date';
import { ParentReportCard, weekLabel } from './ParentReportCard';

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-ink-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex justify-center"><Logo to="/" /></div>
        {children}
        <p className="mt-6 text-center text-xs text-ink-400">This report never contains your child&apos;s doubts, chats or answers.</p>
      </div>
    </div>
  );
}

function LinkProblem({ title, text }) {
  return (
    <Card className="text-center sm:p-10">
      <div className="text-5xl" aria-hidden>🔒</div>
      <h1 className="mt-4 text-xl font-bold">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">{text}</p>
      <Button className="mt-6" variant="outline" to="/">Go to Gyaangrid</Button>
    </Card>
  );
}

/** Public page opened from the parent's email. The signed token is the only credential. */
export default function ParentReportViewPage() {
  useDocumentTitle('Weekly report');
  const [params] = useSearchParams();
  const token = params.get('token');
  const { data: r, error, loading } = useQuery(`parentReportView:${token}`, () => progressApi.parentReportView(token), { enabled: Boolean(token), staleMs: 60000 });

  if (!token) return <Shell><LinkProblem title="This link is incomplete" text="Please open the full link from the weekly report email." /></Shell>;
  if (loading && !r) return <Shell><PageSkeleton rows={1} /></Shell>;
  if (!r) {
    const denied = error?.code === ERROR_CODES.FORBIDDEN || error?.code === ERROR_CODES.UNAUTHENTICATED;
    return <Shell><LinkProblem title={denied ? 'This link has expired' : 'We couldn’t open this report'} text={denied ? 'Report links stop working after a while, or when your child turns them off. A new report arrives every week.' : errorMessage(error)} /></Shell>;
  }

  return (
    <Shell>
      <Card className="sm:p-8">
        <p className="text-sm font-semibold text-brand-600">Weekly Maths report · {weekLabel(r.weekStart, r.weekEnd)}</p>
        <h1 className="mt-1 mb-6 text-2xl font-bold">{r.studentName}&apos;s week</h1>
        <ParentReportCard report={r} name={r.studentName} />
        {r.expiresAt && <p className="mt-6 border-t border-ink-100 pt-4 text-xs text-ink-400">This link works until {formatDate(r.expiresAt)}.</p>}
      </Card>
    </Shell>
  );
}
