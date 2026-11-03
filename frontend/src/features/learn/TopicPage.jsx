import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FileText, PlayCircle, Target, MessageCircleQuestion, NotebookPen, ChevronLeft, ChevronRight, CheckCircle2, Clock, Lock, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, Card, Button, ProgressRing, masteryColor, PageSkeleton, ErrorState, Badge, Modal, EmptyState } from '@/components/ui';
import { RichText } from '@/components/math/RichText';
import { SafeHtml } from '@/components/math/SafeHtml';
import { useQuery, invalidate } from '@/hooks/useQuery';
import { learnApi, doubtApi } from '@/services/api/student';
import { useDocumentTitle } from '@/hooks/useCommon';
import { masteryBand, plural } from '@/lib/format';
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

const isHttpUrl = (u) => /^https:\/\//i.test(String(u || ''));

/**
 * In-app PDF viewer (F3-06). The browser's toolbar is hidden and the context menu disabled; true
 * download protection needs short-lived signed URLs from the server.
 */
function PdfViewer({ block, topicName }) {
  const [open, setOpen] = useState(false);
  const usable = isHttpUrl(block.url);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={!usable} className="card card-hover flex w-full items-center gap-4 p-4 text-left disabled:cursor-not-allowed disabled:opacity-60">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600"><FileText className="h-6 w-6" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-ink-900">{block.title}</span>
          <span className="text-sm text-ink-500">{usable ? `${block.pages ? `${block.pages} pages · ` : ''}opens in the viewer` : 'This PDF is not available right now'}</span>
        </span>
        <ChevronRight className="h-5 w-5 text-ink-300" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={block.title} description={topicName} size="xl">
        <div className="relative h-[70vh] overflow-hidden rounded-xl bg-ink-100" onContextMenu={(e) => e.preventDefault()}>
          <iframe title={block.title} src={`${block.url}#toolbar=0&navpanes=0`} className="absolute inset-0 h-full w-full" referrerPolicy="no-referrer" />
        </div>
        <p className="mt-2 flex items-center gap-1 text-xs text-ink-500"><Lock className="h-3.5 w-3.5" />Licensed material · for personal study in Gyaangrid only</p>
      </Modal>
    </>
  );
}

/** YouTube / Vimeo URL → privacy-friendly embed URL (no third-party tracking cookies for YouTube). */
function toEmbedUrl(url) {
  if (!isHttpUrl(url)) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?rel=0&modestbranding=1`;
    if (host.endsWith('youtube.com')) {
      const id = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` : null;
    }
    if (host === 'vimeo.com') return `https://player.vimeo.com/video/${u.pathname.split('/').filter(Boolean)[0]}`;
    if (host === 'player.vimeo.com') return url;
  } catch { /* invalid URL */ }
  return null;
}

function VideoBlock({ block }) {
  const [playing, setPlaying] = useState(false);
  const embedUrl = toEmbedUrl(block.url);
  const directVideo = !embedUrl && isHttpUrl(block.url) && /\.(mp4|webm|ogg)(\?|$)/i.test(block.url);
  const playable = Boolean(embedUrl || directVideo);
  return (
    <div className="card overflow-hidden p-0">
      <div className="relative aspect-video bg-gradient-to-br from-ink-800 to-brand-900">
        {playing && embedUrl && (
          <iframe title={block.title} src={embedUrl} className="absolute inset-0 h-full w-full" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" />
        )}
        {playing && directVideo && (
          <video src={block.url} controls controlsList="nodownload" className="absolute inset-0 h-full w-full bg-black" onContextMenu={(e) => e.preventDefault()}>
            <track kind="captions" />
          </video>
        )}
        {!playing && (
          <button type="button" disabled={!playable} onClick={() => setPlaying(true)} className="group absolute inset-0 flex flex-col items-center justify-center text-white disabled:cursor-not-allowed">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 backdrop-blur transition group-hover:scale-110 group-hover:bg-white/25"><PlayCircle className="h-10 w-10" /></span>
            <span className="mt-3 font-semibold">{playable ? 'Play video lesson' : 'Video not available right now'}</span>
          </button>
        )}
      </div>
      <div className="flex items-center justify-between p-4">
        <p className="font-bold text-ink-900">{block.title}</p>
        {block.durationSec ? <span className="flex items-center gap-1 text-sm text-ink-500"><Clock className="h-4 w-4" />{humanDuration(block.durationSec)}</span> : null}
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
              {material.blocks.filter((b) => b.type === 'HTML').map((b) => (
                <Card key={b.id} className="sm:p-8">
                  {b.title && <h2 className="mb-4 text-xl font-bold">{b.title}</h2>}
                  <SafeHtml html={b.html} />
                </Card>
              ))}
              {material.blocks.filter((b) => b.type === 'VIDEO' && (b === video || b.id)).map((b, i) => <VideoBlock key={b.id || `v${i}`} block={b} />)}
              {material.blocks.filter((b) => b.type === 'PDF' && (b === pdf || b.id)).map((b, i) => <PdfViewer key={b.id || `p${i}`} block={b} topicName={topic.name} />)}
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
          {doubtApi.available !== false && <Button block size="lg" variant="outline" leftIcon={MessageCircleQuestion} onClick={() => navigate(`/doubts?mode=text&topic=${encodeURIComponent(topic.name)}`)}>Ask a doubt on this topic</Button>}
          {data.activeMistakes > 0 && (
            <Link to={`/mistakes?topicId=${topic.id}&status=ACTIVE`} className="card card-hover flex items-center gap-3 p-4">
              <NotebookPen className="h-5 w-5 text-rose-500" />
              <span className="flex-1 text-sm font-semibold text-ink-800">{data.activeMistakes} active mistake{data.activeMistakes > 1 ? 's' : ''} in this topic</span>
              <Badge tone="danger">Review</Badge>
            </Link>
          )}
          {data.questionCount != null && <p className="text-center text-xs text-ink-400">{plural(data.questionCount, 'question')} available in this topic</p>}
        </aside>
      </div>
      <PracticeSetupModal open={practice} onClose={() => setPractice(false)} scope="TOPIC" targetId={topic.id} title={topic.name} />
    </div>
  );
}
