import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FileText, PlayCircle, Target, MessageCircleQuestion, NotebookPen, ChevronLeft, ChevronRight, CheckCircle2, Clock, Lock, Minus, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, Card, Button, ProgressRing, masteryColor, PageSkeleton, ErrorState, Badge, Modal, EmptyState } from '@/components/ui';
import { RichText } from '@/components/math/RichText';
import { useQuery, invalidate } from '@/hooks/useQuery';
import { learnApi } from '@/services/api/student';
import { useDocumentTitle } from '@/hooks/useCommon';
import { masteryBand } from '@/lib/format';
import { humanDuration } from '@/lib/date';
import { storage } from '@/lib/storage';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { PracticeSetupModal } from '@/features/practice/PracticeSetupModal';

const STUDY_SECONDS = 20; // F3-05

/** F3-08: keep only the last three viewed topics cached for offline reading. */
function rememberTopic(topicId) {
  const recent = storage.get('recentTopics', []).filter((id) => id !== topicId);
  recent.unshift(topicId);
  recent.slice(3).forEach((id) => storage.remove(`q:topic:${id}`));
  storage.set('recentTopics', recent.slice(0, 3));
}

/** In-app PDF viewer. Download and external sharing are disabled by default (F3-06). */
function PdfViewer({ block, topicName }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="card card-hover flex w-full items-center gap-4 p-4 text-left">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600"><FileText className="h-6 w-6" /></span>
        <span className="min-w-0 flex-1"><span className="block truncate font-bold text-ink-900">{block.title}</span><span className="text-sm text-ink-500">{block.pages} pages · opens in the viewer</span></span>
        <ChevronRight className="h-5 w-5 text-ink-300" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={block.title} size="xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ink-100 p-2">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" leftIcon={ChevronLeft} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <span className="px-2 text-sm font-semibold text-ink-600">Page {page} / {block.pages}</span>
            <Button size="sm" variant="ghost" rightIcon={ChevronRight} disabled={page >= block.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.max(0.8, z - 0.1))} aria-label="Zoom out"><Minus className="h-4 w-4" /></Button>
            <span className="w-12 text-center text-sm font-semibold text-ink-600">{Math.round(zoom * 100)}%</span>
            <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))} aria-label="Zoom in"><Plus className="h-4 w-4" /></Button>
            <span className="ml-2 hidden items-center gap-1 text-xs text-ink-500 sm:flex"><Lock className="h-3.5 w-3.5" /> Download disabled</span>
          </div>
        </div>
        <div className="max-h-[60vh] overflow-auto rounded-xl bg-ink-200 p-4" onContextMenu={(e) => e.preventDefault()}>
          <div className="mx-auto origin-top rounded-md bg-white p-8 shadow-lg" style={{ width: `${Math.round(560 * zoom)}px`, maxWidth: '100%', minHeight: 520 * zoom }}>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Gyaangrid practice sheet · page {page}</p>
            <h3 className="mt-2 text-xl font-bold">{topicName}</h3>
            <div className="mt-6 space-y-5">
              {[1, 2, 3, 4].map((n) => (
                <div key={n}>
                  <p className="font-semibold text-ink-800">Q{(page - 1) * 4 + n}.</p>
                  <div className="mt-2 h-2.5 w-11/12 rounded bg-ink-100" /><div className="mt-2 h-2.5 w-3/4 rounded bg-ink-100" />
                </div>
              ))}
            </div>
            <p className="mt-10 text-center text-xs text-ink-400">Licensed material · for personal study in Gyaangrid only</p>
          </div>
        </div>
      </Modal>
    </>
  );
}

function VideoBlock({ block }) {
  const [playing, setPlaying] = useState(false);
  const isEmbeddable = /^https:\/\/(www\.)?(youtube\.com|youtu\.be|player\.vimeo\.com)\//.test(block.url);
  const embedUrl = isEmbeddable ? block.url.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube-nocookie.com/embed/').replace('www.youtube.com', 'www.youtube-nocookie.com') : null;
  return (
    <div className="card overflow-hidden p-0">
      <div className="relative aspect-video bg-gradient-to-br from-ink-800 to-brand-900">
        {playing && embedUrl ? (
          <iframe title={block.title} src={`${embedUrl}?rel=0&modestbranding=1`} className="absolute inset-0 h-full w-full" allow="encrypted-media; picture-in-picture" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" />
        ) : (
          <button type="button" onClick={() => { setPlaying(true); if (!embedUrl) toast.info('Demo mode: the admin-attached video link will stream here.'); }} className="group absolute inset-0 flex flex-col items-center justify-center text-white">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 backdrop-blur transition group-hover:scale-110 group-hover:bg-white/25"><PlayCircle className="h-10 w-10" /></span>
            <span className="mt-3 font-semibold">{playing ? 'Video preview unavailable in demo' : 'Play video lesson'}</span>
          </button>
        )}
      </div>
      <div className="flex items-center justify-between p-4">
        <p className="font-bold text-ink-900">{block.title}</p>
        {block.durationSec && <span className="flex items-center gap-1 text-sm text-ink-500"><Clock className="h-4 w-4" />{humanDuration(block.durationSec)}</span>}
      </div>
    </div>
  );
}

export default function TopicPage() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const { data, error, loading, refetch } = useQuery(`topic:${topicId}`, () => learnApi.topic(topicId), { persist: true });
  const [practice, setPractice] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [studied, setStudied] = useState(false);
  const reported = useRef(false);
  useDocumentTitle(data?.topic?.name || 'Topic');

  useEffect(() => { if (data) { rememberTopic(topicId); setStudied(data.studied); } }, [data, topicId]);

  // Study timer: counts only while the tab is visible
  useEffect(() => {
    reported.current = false;
    setSeconds(0);
    const id = setInterval(() => { if (document.visibilityState === 'visible') setSeconds((s) => s + 1); }, 1000);
    return () => clearInterval(id);
  }, [topicId]);

  const secondsRef = useRef(0);
  secondsRef.current = seconds;
  useEffect(() => {
    if (seconds >= STUDY_SECONDS && !reported.current && data?.material) {
      reported.current = true;
      learnApi.recordView(topicId, seconds).then((r) => {
        if (r.newlyStudied) {
          setStudied(true);
          toast.success('Topic marked as studied ✅');
          track('material_viewed', { topicId });
          invalidate('curriculum');
          invalidate('home');
        }
      }).catch(() => {});
    }
  }, [seconds, topicId, data]);
  // Record the view (for Continue Learning) when leaving the page
  useEffect(() => () => { if (secondsRef.current > 2) learnApi.recordView(topicId, secondsRef.current).then(() => invalidate('home')).catch(() => {}); }, [topicId]);

  if (loading && !data) return <PageSkeleton rows={2} />;
  if (!data) return <ErrorState error={error} onRetry={refetch} />;

  const { topic, material, stats } = data;
  const band = masteryBand(stats?.mastery);
  const text = material?.blocks.find((b) => b.type === 'TEXT');
  const pdf = material?.blocks.find((b) => b.type === 'PDF');
  const video = material?.blocks.find((b) => b.type === 'VIDEO');

  return (
    <div>
      <PageHeader back={{ to: `/learn/chapter/${topic.chapterId}`, label: topic.chapterName }} eyebrow="Topic" title={topic.name} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {material ? (
            <>
              {text && <Card className="sm:p-8"><RichText source={text.body} /></Card>}
              {video && <VideoBlock block={video} />}
              {pdf && <PdfViewer block={pdf} topicName={topic.name} />}
            </>
          ) : (
            <EmptyState emoji="📝" title="Notes are on the way" description="Our teachers are still writing the notes for this topic. You can already practise it or ask a doubt." />
          )}
          <div className="flex items-center justify-between gap-3">
            {data.prev ? <Button variant="ghost" leftIcon={ChevronLeft} to={`/learn/topic/${data.prev.id}`} className="max-w-[48%] truncate">{data.prev.name}</Button> : <span />}
            {data.next ? <Button variant="ghost" rightIcon={ChevronRight} to={`/learn/topic/${data.next.id}`} className="max-w-[48%] truncate">{data.next.name}</Button> : <span />}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <div className="flex items-center gap-4">
              <ProgressRing value={stats?.mastery ?? 0} size={72} stroke={7} tone={masteryColor(stats?.mastery)}>
                <span className="font-display text-lg font-bold">{stats?.mastery ?? '–'}</span>
              </ProgressRing>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Your mastery</p>
                <p className="font-bold text-ink-900">{band.label}</p>
                <p className="text-sm text-ink-500">{stats ? `${stats.accuracy}% accuracy · ${stats.attempts} tries` : 'Not attempted yet'}</p>
              </div>
            </div>
            {stats?.last5?.length > 0 && (
              <div className="mt-4">
                <p className="mb-1.5 text-xs font-semibold text-ink-500">Last {stats.last5.length} answers</p>
                <div className="flex gap-1.5">
                  {stats.last5.map((ok, i) => (
                    <span key={i} className={cn('flex h-7 w-7 items-center justify-center rounded-lg text-white', ok ? 'bg-emerald-500' : 'bg-rose-400')} aria-label={ok ? 'Correct' : 'Incorrect'}>
                      {ok ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-600">
              {studied ? <span className="flex items-center gap-1.5 font-semibold text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Studied</span>
                : material ? <span>Read for {Math.max(0, STUDY_SECONDS - seconds)}s more to mark this topic as studied.</span> : <span>Practise to build mastery.</span>}
            </div>
          </Card>
          <Button block size="lg" leftIcon={Target} onClick={() => setPractice(true)}>Practise this topic</Button>
          <Button block size="lg" variant="outline" leftIcon={MessageCircleQuestion} onClick={() => navigate(`/doubts?mode=text&topic=${encodeURIComponent(topic.name)}`)}>Ask a doubt on this topic</Button>
          {data.activeMistakes > 0 && (
            <Link to={`/mistakes?topicId=${topic.id}&status=ACTIVE`} className="card card-hover flex items-center gap-3 p-4">
              <NotebookPen className="h-5 w-5 text-rose-500" />
              <span className="flex-1 text-sm font-semibold text-ink-800">{data.activeMistakes} active mistake{data.activeMistakes > 1 ? 's' : ''} in this topic</span>
              <Badge tone="danger">Review</Badge>
            </Link>
          )}
          <p className="text-center text-xs text-ink-400">{data.questionCount} questions available in this topic</p>
        </aside>
      </div>
      <PracticeSetupModal open={practice} onClose={() => setPractice(false)} scope="TOPIC" targetId={topic.id} title={topic.name} />
    </div>
  );
}
