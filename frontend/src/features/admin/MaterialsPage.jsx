import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Save, Eye, Pencil, FileText, Video, History, Upload, Bold, Italic, List, ListOrdered,
  Heading2, Heading3, Code2, Minus, Lightbulb, Sigma, Table2, Plus, Trash2, CheckCircle2,
  ExternalLink, Sparkles, BookOpen, Layers, HelpCircle, AlertCircle, FileCode, Play
} from 'lucide-react';
import { Card, Button, TextField, SelectField, PageSkeleton, EmptyState, Alert } from '@/components/ui';
import { RichText } from '@/components/math/RichText';
import { SafeHtml } from '@/components/math/SafeHtml';
import { useQuery } from '@/hooks/useQuery';
import { adminApi } from '@/services/api/admin';
import { ERROR_CODES, errorMessage } from '@/services/errors';
import { useDocumentTitle } from '@/hooks/useCommon';
import { formatDateTime } from '@/lib/date';
import { cn } from '@/lib/cn';
import { AdminPageHeader, ClassSelect, StatusBadge, useCan, ReadOnlyNote, ADMIN_CAPS, supports } from './adminShared';

const HTML = ADMIN_CAPS?.materialFormat === 'html';

/** Rich text formatting toolbar that inserts clean HTML tags at cursor position */
function FormattingToolbar({ textareaRef, onInsert }) {
  const tools = [
    { label: 'H2', icon: Heading2, title: 'Main Heading', insert: (sel) => `<h2>${sel || 'Heading'}</h2>\n` },
    { label: 'H3', icon: Heading3, title: 'Sub Heading', insert: (sel) => `<h3>${sel || 'Subheading'}</h3>\n` },
    { label: 'B', icon: Bold, title: 'Bold Text', insert: (sel) => `<strong>${sel || 'important'}</strong>` },
    { label: 'I', icon: Italic, title: 'Italic Text', insert: (sel) => `<em>${sel || 'emphasis'}</em>` },
    { label: 'Bullets', icon: List, title: 'Bullet List', insert: (sel) => `<ul>\n  <li>${sel || 'Point 1'}</li>\n  <li>Point 2</li>\n</ul>\n` },
    { label: 'Numbered', icon: ListOrdered, title: 'Numbered List', insert: (sel) => `<ol>\n  <li>${sel || 'Step 1'}</li>\n  <li>Step 2</li>\n</ol>\n` },
    { label: 'Concept', icon: Lightbulb, title: 'Key Concept Box', insert: (sel) => `<div class="p-4 my-3 rounded-xl bg-brand-50 border border-brand-200">\n  <strong class="text-brand-900">Key Concept:</strong>\n  <p>${sel || 'Core concept explanation goes here.'}</p>\n</div>\n` },
    { label: 'Example', icon: Sparkles, title: 'Solved Example', insert: (sel) => `<div class="p-4 my-3 rounded-xl bg-emerald-50 border border-emerald-200">\n  <strong class="text-emerald-900">Example:</strong> ${sel || 'Problem statement'}\n  <p class="mt-2 text-sm text-ink-700"><strong>Solution:</strong> Step-by-step solution...</p>\n</div>\n` },
    { label: 'Math $', icon: Sigma, title: 'Inline Math', insert: (sel) => `$${sel || 'x^2 + y^2 = r^2'}$` },
    { label: 'Math $$', icon: Sigma, title: 'Display Math Block', insert: (sel) => `\n$$${sel || '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n'}` },
    { label: 'Table', icon: Table2, title: 'Comparison Table', insert: () => `<table class="w-full text-sm border border-ink-200 my-3">\n  <thead>\n    <tr class="bg-ink-100">\n      <th class="p-2 border">Property</th>\n      <th class="p-2 border">Value</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <td class="p-2 border">Item 1</td>\n      <td class="p-2 border">Details</td>\n    </tr>\n  </tbody>\n</table>\n` },
    { label: 'Line', icon: Minus, title: 'Divider Line', insert: () => `<hr class="my-4 border-ink-200" />\n` },
  ];

  const handleToolClick = (tool) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = el.value.substring(start, end);
    const insertion = tool.insert(selected);
    onInsert(insertion, start, end);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-ink-200 bg-ink-50/90 px-3 py-2 rounded-t-xl">
      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-400 mr-2 flex items-center gap-1">
        <Sparkles className="h-3 w-3 text-brand-500" /> Format:
      </span>
      {tools.map((t) => (
        <button
          key={t.label}
          type="button"
          title={t.title}
          onClick={() => handleToolClick(t)}
          className="flex h-7 items-center gap-1 rounded-lg border border-transparent bg-white px-2 text-xs font-semibold text-ink-700 shadow-sm hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition"
        >
          <t.icon className="h-3.5 w-3.5" />
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Visual Content Block Builder - creates rich structured content without typing raw HTML */
function VisualBlockBuilder({ htmlContent, onChange }) {
  // Parse blocks or default to structured cards
  const [blocks, setBlocks] = useState([
    { id: 1, type: 'concept', title: 'Key Definition', content: '' },
    { id: 2, type: 'explanation', title: 'Detailed Explanation', content: '' },
    { id: 3, type: 'example', title: 'Solved Example', content: '', solution: '' },
    { id: 4, type: 'formula', title: 'Important Formulas', content: '' },
  ]);

  const addBlock = (type) => {
    const templates = {
      heading: { title: 'New Section', content: '' },
      concept: { title: 'Key Concept', content: '' },
      example: { title: 'Example 1', content: 'Find the value of...', solution: 'Step 1: ...' },
      formula: { title: 'Formula', content: '$a^2 + b^2 = c^2$' },
      tip: { title: 'Exam Tip', content: 'Remember to always check the signs.' },
      points: { title: 'Important Points', content: '• Point 1\n• Point 2\n• Point 3' },
    };
    const t = templates[type] || { title: 'Section', content: '' };
    setBlocks((prev) => [...prev, { id: Date.now(), type, ...t }]);
  };

  const updateBlock = (id, field, value) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const removeBlock = (id) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const compileToHtml = () => {
    const parts = blocks.map((b) => {
      switch (b.type) {
        case 'heading':
          return `<h2>${b.title}</h2>\n<p>${b.content}</p>`;
        case 'concept':
          return `<div class="p-4 my-3 rounded-xl bg-brand-50 border border-brand-200">\n  <h3 class="text-base font-bold text-brand-900 mb-1">${b.title}</h3>\n  <p class="text-ink-800">${b.content}</p>\n</div>`;
        case 'example':
          return `<div class="p-4 my-3 rounded-xl bg-emerald-50 border border-emerald-200">\n  <h3 class="text-base font-bold text-emerald-900 mb-1">${b.title}</h3>\n  <p class="font-medium text-ink-900 mb-2">${b.content}</p>\n  <div class="text-sm text-ink-700 bg-white/70 p-2.5 rounded-lg border border-emerald-100"><strong>Solution:</strong> ${b.solution}</div>\n</div>`;
        case 'formula':
          return `<div class="p-4 my-3 rounded-xl bg-amber-50 border border-amber-200">\n  <h3 class="text-sm font-bold text-amber-900 uppercase tracking-wide mb-1">📐 ${b.title}</h3>\n  <div class="text-base font-semibold text-ink-900 text-center py-2">${b.content}</div>\n</div>`;
        case 'tip':
          return `<div class="p-3 my-2 rounded-xl bg-sky-50 border border-sky-200 text-sm text-sky-900 flex items-start gap-2">\n  <span>💡</span><div><strong>${b.title}:</strong> ${b.content}</div>\n</div>`;
        case 'points':
          return `<div class="my-3">\n  <h3 class="font-bold text-ink-900 mb-2">${b.title}</h3>\n  <ul class="list-disc pl-5 space-y-1 text-ink-800">\n${b.content.split('\n').filter(Boolean).map((pt) => `    <li>${pt.replace(/^[•\-\*]\s*/, '')}</li>`).join('\n')}\n  </ul>\n</div>`;
        default:
          return `<p>${b.content}</p>`;
      }
    });
    onChange(parts.join('\n\n'));
    toast.success('Compiled into content HTML!');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-brand-50/50 rounded-xl border border-brand-100">
        <div>
          <p className="text-xs font-bold text-brand-900">Form-Based Content Builder (No HTML needed!)</p>
          <p className="text-xs text-ink-500">Fill out easy input fields below, then click "Apply to Notes".</p>
        </div>
        <Button size="sm" variant="brand" leftIcon={CheckCircle2} onClick={compileToHtml}>
          Apply to Notes
        </Button>
      </div>

      <div className="space-y-3">
        {blocks.map((b, idx) => (
          <div key={b.id} className="rounded-xl border border-ink-200 bg-white p-3.5 shadow-sm transition hover:border-brand-200">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-wider text-ink-500">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-100 text-[10px] text-ink-700">
                  {idx + 1}
                </span>
                {b.type}
              </span>
              <button
                type="button"
                onClick={() => removeBlock(b.id)}
                className="text-ink-400 hover:text-rose-600 transition"
                title="Remove block"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <input
              type="text"
              value={b.title}
              onChange={(e) => updateBlock(b.id, 'title', e.target.value)}
              placeholder="Block Title / Heading..."
              className="mb-2 w-full rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-semibold text-ink-900 focus:border-brand-500 focus:outline-none"
            />

            <textarea
              rows={b.type === 'points' ? 4 : 2}
              value={b.content}
              onChange={(e) => updateBlock(b.id, 'content', e.target.value)}
              placeholder={b.type === 'formula' ? 'e.g. $a^2 + b^2 = c^2$' : b.type === 'points' ? '• Point 1\n• Point 2' : 'Content details... (supports $math$)'}
              className="w-full rounded-lg border border-ink-200 p-2.5 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
            />

            {b.type === 'example' && (
              <div className="mt-2">
                <label className="text-xs font-bold text-ink-600">Solution steps:</label>
                <textarea
                  rows={2}
                  value={b.solution}
                  onChange={(e) => updateBlock(b.id, 'solution', e.target.value)}
                  placeholder="Step 1: ... Step 2: ..."
                  className="mt-1 w-full rounded-lg border border-ink-200 p-2 text-xs text-ink-800 focus:border-brand-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-ink-100">
        <span className="text-xs font-bold text-ink-500">Add Block:</span>
        <button type="button" onClick={() => addBlock('concept')} className="rounded-lg border border-brand-200 bg-brand-50/50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">
          + Key Concept
        </button>
        <button type="button" onClick={() => addBlock('example')} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
          + Solved Example
        </button>
        <button type="button" onClick={() => addBlock('formula')} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100">
          + Formula
        </button>
        <button type="button" onClick={() => addBlock('points')} className="rounded-lg border border-ink-200 bg-ink-50 px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-100">
          + Bullet Points
        </button>
        <button type="button" onClick={() => addBlock('tip')} className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100">
          + Exam Tip
        </button>
      </div>
    </div>
  );
}

/** Study material manager: rich form builder + visual editor + live preview + PDF & Video */
export default function MaterialsPage() {
  useDocumentTitle('Study material');
  const canEdit = useCan('editContent');
  const [classId, setClassId] = useState(8);
  const { data: cur } = useQuery(`admin:curriculum:${classId}`, () => adminApi.curriculum(classId));
  const [chapterId, setChapterId] = useState('');
  const [topicId, setTopicId] = useState('');
  const chapter = cur?.chapters?.find((c) => c.id === chapterId);
  const topic = chapter?.topics?.find((t) => t.id === topicId);

  useEffect(() => { setChapterId(''); setTopicId(''); }, [classId]);
  useEffect(() => {
    if (cur && !chapterId && cur.chapters?.[0]) {
      setChapterId(cur.chapters[0].id);
      setTopicId(cur.chapters[0].topics?.[0]?.id || '');
    }
  }, [cur, chapterId]);

  const { data, loading, refetch } = useQuery(`admin:material:${topicId}`, () => adminApi.material(topicId), {
    enabled: Boolean(topicId),
    staleMs: 0,
  });

  const [form, setForm] = useState(null);
  const [editorMode, setEditorMode] = useState('editor'); // 'editor' | 'builder' | 'preview'
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const pdfRef = useRef(null);
  const textareaRef = useRef(null);

  // Extract YouTube ID for live preview
  const ytMatch = form?.videoUrl?.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  const ytVideoId = ytMatch ? ytMatch[1] : null;

  const uploadPdf = async (file) => {
    if (pdfRef.current) pdfRef.current.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await adminApi.uploadPdf(file);
      setForm((f) => ({ ...f, pdfUrl: url, pdfTitle: f.pdfTitle || file.name }));
      toast.success('PDF uploaded successfully. Save or publish to attach it.');
    } catch (e) {
      toast.error(e.code === ERROR_CODES.SERVICE_UNAVAILABLE ? 'File storage is not configured yet. Paste an https link instead.' : errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => { setForm(null); }, [topicId]);

  useEffect(() => {
    if (!data || data.topic?.id !== topicId) return;
    const m = data.material;
    const text = m.blocks?.find((b) => b.type === 'TEXT');
    const pdf = m.blocks?.find((b) => b.type === 'PDF');
    const video = m.blocks?.find((b) => b.type === 'VIDEO');
    setForm({
      title: m.title || '',
      body: text?.body || '',
      pdfTitle: pdf?.title || '',
      pdfPages: pdf?.pages || '',
      pdfUrl: pdf?.url?.startsWith('https://') ? pdf.url : '',
      videoTitle: video?.title || '',
      videoUrl: video?.url?.startsWith('mock://') ? '' : video?.url || '',
      status: m.status || 'DRAFT',
    });
  }, [data, topicId]);

  const dirty = useMemo(() => Boolean(form), [form]);

  const handleToolbarInsert = (insertion, start, end) => {
    if (!form) return;
    const current = form.body || '';
    const next = current.substring(0, start) + insertion + current.substring(end);
    setForm({ ...form, body: next });
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = start + insertion.length;
        textareaRef.current.selectionEnd = start + insertion.length;
      }
    }, 0);
  };

  const save = async (status) => {
    setBusy(true);
    try {
      await adminApi.saveMaterial(topicId, {
        title: form.title,
        body: form.body,
        status: status || form.status,
        pdf: HTML
          ? (form.pdfUrl ? { title: form.pdfTitle || 'Worksheet PDF', url: form.pdfUrl } : null)
          : (form.pdfTitle ? { title: form.pdfTitle, pages: Number(form.pdfPages) || 1 } : null),
        video: form.videoUrl ? { title: form.videoTitle || 'Video Lesson', url: form.videoUrl } : null,
      });
      toast.success(status === 'PUBLISHED' ? 'Published! Live for students on next launch.' : 'Draft saved.');
      refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Study Materials & Notes"
        subtitle="Create engaging learning content with formula support, interactive callouts, PDFs, and videos."
      />
      {!canEdit && <ReadOnlyNote />}

      {/* Curriculum hierarchy picker */}
      <Card className="grid gap-3 sm:grid-cols-3 p-4 bg-gradient-to-r from-white via-ink-50/30 to-brand-50/20">
        <ClassSelect value={classId} onChange={setClassId} />
        <SelectField
          label="Chapter"
          value={chapterId}
          onChange={(e) => {
            setChapterId(e.target.value);
            setTopicId(cur?.chapters?.find((c) => c.id === e.target.value)?.topics?.[0]?.id || '');
          }}
          options={(cur?.chapters || []).map((c) => ({ value: c.id, label: `${c.number ? `${c.number}. ` : ''}${c.name}` }))}
        />
        <SelectField
          label="Topic"
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          options={(chapter?.topics || []).map((t) => ({ value: t.id, label: t.name }))}
          disabled={!chapter}
        />
      </Card>

      {!topicId ? (
        <EmptyState
          icon={BookOpen}
          title="Select a Topic"
          description="Choose a class, chapter, and topic to view and manage its study materials."
        />
      ) : !data || !form ? (
        loading ? <PageSkeleton rows={1} /> : <EmptyState title="Couldn't load topic" description="Please retry." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Main content editor */}
          <div className="space-y-4">
            <Card className="overflow-hidden">
              {/* Header with mode tabs & status */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-3">
                <div className="flex items-center gap-1.5 rounded-xl bg-ink-100 p-1">
                  <button
                    type="button"
                    onClick={() => setEditorMode('editor')}
                    className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition', editorMode === 'editor' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900')}
                  >
                    <FileCode className="h-3.5 w-3.5" />
                    Editor & Toolbar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('builder')}
                    className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition', editorMode === 'builder' ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-600 hover:text-ink-900')}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Visual Blocks
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('preview')}
                    className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition', editorMode === 'preview' ? 'bg-white text-emerald-700 shadow-sm' : 'text-ink-600 hover:text-ink-900')}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Student View
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={data.material.status} />
                  <span className="rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-mono text-ink-500">
                    v{data.material.version || 1}
                  </span>
                </div>
              </div>

              {/* Title input */}
              <div className="mb-4">
                <TextField
                  label="Material Title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  disabled={!canEdit}
                  placeholder="e.g. Introduction to Rational Numbers"
                  required
                />
              </div>

              {/* View 1: Direct Editor with Toolbar */}
              {editorMode === 'editor' && (
                <div>
                  <label className="label flex items-center justify-between">
                    <span>Notes Content (HTML / Text)</span>
                    <span className="text-xs text-ink-400 font-normal">Use toolbar to insert formatting easily</span>
                  </label>
                  <div className="rounded-xl border border-ink-200 overflow-hidden focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15 transition">
                    <FormattingToolbar textareaRef={textareaRef} onInsert={handleToolbarInsert} />
                    <textarea
                      ref={textareaRef}
                      value={form.body}
                      onChange={(e) => setForm({ ...form, body: e.target.value })}
                      rows={18}
                      disabled={!canEdit}
                      className="w-full p-4 font-mono text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none resize-y"
                      placeholder="Write comprehensive notes here... Use the toolbar above to add headings, formulas, examples, and tips without typing HTML tags!"
                    />
                  </div>
                </div>
              )}

              {/* View 2: Form-based block builder */}
              {editorMode === 'builder' && (
                <VisualBlockBuilder
                  htmlContent={form.body}
                  onChange={(newHtml) => {
                    setForm({ ...form, body: newHtml });
                    setEditorMode('editor');
                  }}
                />
              )}

              {/* View 3: Student preview */}
              {editorMode === 'preview' && (
                <div>
                  <div className="mb-3 flex items-center justify-between text-xs text-ink-500 bg-ink-50 px-3 py-2 rounded-lg">
                    <span>📱 Live preview as rendered for students:</span>
                    <span>Sanitized & Formatted</span>
                  </div>
                  <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm min-h-[300px]">
                    <h1 className="text-2xl font-bold font-display text-ink-900 mb-4 pb-2 border-b border-ink-100">
                      {form.title || 'Untitled Notes'}
                    </h1>
                    {form.body ? (
                      HTML ? <SafeHtml html={form.body} /> : <RichText source={form.body} />
                    ) : (
                      <p className="text-sm italic text-ink-400">No content entered yet.</p>
                    )}
                  </div>
                </div>
              )}
            </Card>

            {/* Bottom action bar */}
            {canEdit && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-ink-100 shadow-sm">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    leftIcon={Save}
                    loading={busy}
                    disabled={!dirty}
                    onClick={() => save('DRAFT')}
                  >
                    Save Draft
                  </Button>
                  <Button
                    variant="brand"
                    leftIcon={CheckCircle2}
                    loading={busy}
                    disabled={!form.title?.trim() || !form.body?.trim()}
                    onClick={() => save('PUBLISHED')}
                  >
                    Publish to Students
                  </Button>
                </div>
                {data.material.status === 'PUBLISHED' && (
                  <Button variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => save('RETIRED')}>
                    Retire Material
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Right sidebar: attachments & details */}
          <div className="space-y-4">
            {/* PDF attachment card */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center gap-2 font-bold text-ink-900">
                  <FileText className="h-4 w-4 text-rose-500" />
                  PDF Worksheet
                </span>
                {form.pdfUrl && <span className="chip bg-emerald-50 text-emerald-700 text-[10px]">Attached</span>}
              </div>

              <TextField
                label="File Label"
                value={form.pdfTitle}
                onChange={(e) => setForm({ ...form, pdfTitle: e.target.value })}
                disabled={!canEdit}
                placeholder="e.g. Chapter 1 Practice Worksheet.pdf"
              />

              <div className="mt-3">
                <TextField
                  label="PDF Link (https)"
                  value={form.pdfUrl}
                  onChange={(e) => setForm({ ...form, pdfUrl: e.target.value })}
                  disabled={!canEdit}
                  placeholder="https://.../notes.pdf"
                  hint="Upload below or paste a secure link."
                />
              </div>

              {canEdit && supports('pdfUpload') && (
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={Upload}
                    className="w-full"
                    loading={uploading}
                    onClick={() => (HTML ? pdfRef.current?.click() : toast.info('PDFs upload via cloud bucket.'))}
                  >
                    Upload PDF (max 20 MB)
                  </Button>
                  <input
                    ref={pdfRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => uploadPdf(e.target.files?.[0])}
                  />
                </div>
              )}
              <p className="mt-2 text-[11px] text-ink-400">PDFs open in secure in-app viewer; downloads are protected.</p>
            </Card>

            {/* Video link card */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center gap-2 font-bold text-ink-900">
                  <Video className="h-4 w-4 text-sky-500" />
                  Video Lesson
                </span>
                {form.videoUrl && <span className="chip bg-sky-50 text-sky-700 text-[10px]">Linked</span>}
              </div>

              <TextField
                label="Video Title"
                value={form.videoTitle}
                onChange={(e) => setForm({ ...form, videoTitle: e.target.value })}
                disabled={!canEdit}
                placeholder="e.g. Concepts Explanation Video"
              />

              <div className="mt-3">
                <TextField
                  label="YouTube / Vimeo URL"
                  value={form.videoUrl}
                  onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                  disabled={!canEdit}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>

              {/* YouTube Thumbnail Preview */}
              {ytVideoId && (
                <div className="mt-3 overflow-hidden rounded-xl border border-ink-100 bg-ink-950">
                  <div className="relative aspect-video">
                    <img
                      src={`https://img.youtube.com/vi/${ytVideoId}/hqdefault.jpg`}
                      alt="Video thumbnail"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg">
                        <Play className="h-5 w-5 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <p className="p-2 text-center text-[11px] text-white/70 truncate">{form.videoTitle || 'YouTube Video'}</p>
                </div>
              )}
            </Card>

            {/* Version history */}
            {supports('versionHistory') && (
              <Card>
                <p className="mb-2.5 flex items-center gap-2 font-bold text-ink-900">
                  <History className="h-4 w-4 text-ink-400" />
                  Version History
                </p>
                {data.history?.length === 0 ? (
                  <p className="text-xs text-ink-400">Initial version.</p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {(data.history || []).map((h, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 border-b border-ink-50 pb-1.5 last:border-0">
                        <span className="truncate font-medium text-ink-700">
                          {h.action ? `${h.action.toLowerCase()}${h.by ? ` · ${h.by}` : ''}` : `v${h.version} · ${h.status}`}
                        </span>
                        <span className="shrink-0 text-ink-400">{h.updatedAt ? formatDateTime(h.updatedAt) : ''}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}

            <Alert tone="info">
              Students can access Practice and Doubts even if this topic has no study materials published yet.
            </Alert>
          </div>
        </div>
      )}
    </div>
  );
}
