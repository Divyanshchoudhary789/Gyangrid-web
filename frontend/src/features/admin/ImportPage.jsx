import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Upload, Download, CheckCircle2, XCircle, ArrowLeft, FileSpreadsheet,
  Pencil, RefreshCw, AlertTriangle, Eye, HelpCircle, Check, Sparkles
} from 'lucide-react';
import { Card, Button, Alert, Badge, Modal, TextField, SelectField, TextArea } from '@/components/ui';
import { adminApi } from '@/services/api/admin';
import { errorMessage } from '@/services/errors';
import { useDocumentTitle } from '@/hooks/useCommon';
import { AdminPageHeader, AdminTable } from './adminShared';

const MOCK_COLUMNS = ['topicId', 'type', 'difficulty', 'questionText', 'optionA', 'optionB', 'optionC', 'optionD', 'correctAnswer', 'answerTolerance', 'explanation', 'conceptNote'];
const MOCK_TEMPLATE = `${MOCK_COLUMNS.join(',')}
c8_ch02_t1,NUMERIC,EASY,"Solve for $x$: $3x + 4 = 19$",,,,,5,0,"Subtract 4 from both sides: $3x = 15$|Divide by 3: $x = 5$","Keep the equation balanced."
c8_ch05_t2,MCQ_SINGLE,MEDIUM,"Find $\\sqrt{196}$",12,14,16,18,B,0,"$14 \\times 14 = 196$|So $\\sqrt{196} = 14$",
c8_ch05_t2,MCQ_SINGLE,HARD,"This row has no explanation",1,2,3,4,A,0,,`;

const SPEC = adminApi.importSpec || { columns: MOCK_COLUMNS, template: MOCK_TEMPLATE, note: null };
const COLUMNS = SPEC.columns;
const TEMPLATE = SPEC.template;

/** RFC-4180-ish CSV parser (quotes, escaped quotes, commas and newlines inside quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

/** Bulk import with live row-level editing and validation before commit */
export default function ImportPage() {
  useDocumentTitle('Bulk import');
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [rows, setRows] = useState(null);
  const [report, setReport] = useState(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingRowIndex, setEditingRowIndex] = useState(null);
  const [rowEditForm, setRowEditForm] = useState(null);

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gyaangrid-question-template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const validateRows = async (rawRows) => {
    setBusy(true);
    try {
      const res = await adminApi.validateImport(rawRows);
      setReport(res);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      toast.error('Please upload a .csv file (save XLSX as CSV first).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5 MB.');
      return;
    }
    setFileName(file.name);
    const parsed = parseCsv(await file.text());
    if (!parsed.length) {
      toast.error('No rows found in this file.');
      return;
    }
    setRows(parsed);
    await validateRows(parsed);
  };

  const commit = async () => {
    setBusy(true);
    try {
      const res = await adminApi.commitImport(rows);
      toast.success(
        `${res.imported} questions successfully imported${adminApi.importSpec ? ' as drafts' : ' to the review queue'}. ${res.rejected} skipped.`
      );
      navigate('/admin/questions');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Open inline modal for an errored row
  const startEditRow = (reportRowIndex) => {
    const rawRow = rows[reportRowIndex];
    if (!rawRow) return;
    setEditingRowIndex(reportRowIndex);
    setRowEditForm({ ...rawRow });
  };

  // Save the inline edited row and re-run validation automatically!
  const saveEditedRow = async () => {
    if (editingRowIndex === null || !rowEditForm) return;
    const updatedRows = [...rows];
    updatedRows[editingRowIndex] = rowEditForm;
    setRows(updatedRows);
    setEditingRowIndex(null);
    setRowEditForm(null);
    toast.success('Row updated. Re-validating...');
    await validateRows(updatedRows);
  };

  const valid = report?.rows?.filter((r) => r.valid).length || 0;
  const invalid = (report?.rows?.length || 0) - valid;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('/admin/questions')}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-brand-600 transition"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Question Bank
      </button>

      <AdminPageHeader
        title="Bulk Question Import"
        subtitle={
          adminApi.importSpec
            ? 'Upload a CSV of multiple questions. Validate and fix errors inline before publishing to students.'
            : 'Upload a CSV. We validate every row before anything is saved.'
        }
        action={
          <Button variant="outline" leftIcon={Download} onClick={downloadTemplate}>
            Download CSV Template
          </Button>
        }
      />

      {SPEC.note && <Alert tone="info">{SPEC.note}</Alert>}

      {/* Upload Dropzone */}
      <Card>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 py-10 text-ink-500 transition hover:border-brand-400 hover:bg-brand-50/40"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <FileSpreadsheet className="h-7 w-7" />
          </div>
          <span className="font-bold text-base text-ink-900">{fileName || 'Choose or Drop CSV File Here'}</span>
          <span className="text-xs text-ink-400">Max size: 5 MB · Steps separated by “|” in explanation</span>
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </Card>

      {/* Validation results & table */}
      {report && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-ink-100 shadow-sm">
            <div className="flex items-center gap-3">
              <Badge tone="success" icon={CheckCircle2}>
                {valid} Valid Rows Ready
              </Badge>
              {invalid > 0 && (
                <Badge tone="danger" icon={XCircle}>
                  {invalid} Rows Need Fixing
                </Badge>
              )}
            </div>
            <Button
              variant="brand"
              leftIcon={Upload}
              disabled={!valid}
              loading={busy}
              onClick={commit}
            >
              Commit &amp; Import {valid} Valid Questions
            </Button>
          </div>

          {invalid > 0 && (
            <Alert tone="warning" title="Fix Errors Directly in Browser">
              You don&apos;t need to re-upload your CSV! Click <strong>&quot;Fix Row&quot;</strong> on any row below to correct mistakes directly.
            </Alert>
          )}

          <AdminTable
            rowKey={(r) => r.row}
            rows={report.rows}
            columns={[
              { key: 'row', label: 'Row #', className: 'w-16 font-mono text-xs font-semibold' },
              {
                key: 'status',
                label: 'Status',
                render: (r) =>
                  r.valid ? (
                    <span className="chip bg-emerald-50 text-emerald-700 text-xs font-bold">Valid</span>
                  ) : (
                    <span className="chip bg-rose-50 text-rose-700 text-xs font-bold">Error</span>
                  ),
              },
              { key: 'topicName', label: 'Topic / ID', className: 'text-xs text-ink-600' },
              {
                key: 'questionText',
                label: 'Question Preview',
                className: 'max-w-xs truncate font-medium text-ink-900',
              },
              {
                key: 'errors',
                label: 'Identified Issue',
                className: 'text-xs text-rose-600',
                render: (r) => (r.errors?.length ? r.errors.join(' · ') : '—'),
              },
              {
                key: 'actions',
                label: '',
                render: (r, idx) => (
                  <Button
                    size="xs"
                    variant={r.valid ? 'ghost' : 'outline'}
                    leftIcon={Pencil}
                    onClick={() => startEditRow(idx)}
                  >
                    Fix Row
                  </Button>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* Inline Row Fix Modal */}
      {rowEditForm && (
        <Modal
          open
          onClose={() => setRowEditForm(null)}
          title={`Edit Row #${editingRowIndex + 2}`}
          description="Update values directly. Upon clicking 'Save & Re-validate', the system checks this row again."
          footer={
            <>
              <Button variant="outline" onClick={() => setRowEditForm(null)}>
                Cancel
              </Button>
              <Button variant="brand" leftIcon={Check} onClick={saveEditedRow}>
                Save &amp; Re-validate
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Topic ID"
                value={rowEditForm.topicId || ''}
                onChange={(e) => setRowEditForm({ ...rowEditForm, topicId: e.target.value })}
                required
              />
              <SelectField
                label="Difficulty"
                value={rowEditForm.difficulty || 'EASY'}
                onChange={(e) => setRowEditForm({ ...rowEditForm, difficulty: e.target.value })}
                options={[
                  { value: 'EASY', label: 'EASY' },
                  { value: 'MEDIUM', label: 'MEDIUM' },
                  { value: 'HARD', label: 'HARD' },
                ]}
              />
            </div>

            <TextArea
              label="Question Text"
              value={rowEditForm.questionText || ''}
              onChange={(e) => setRowEditForm({ ...rowEditForm, questionText: e.target.value })}
              rows={2}
              required
            />

            <div className="grid grid-cols-2 gap-2">
              <TextField
                label="Option A"
                value={rowEditForm.optionA || ''}
                onChange={(e) => setRowEditForm({ ...rowEditForm, optionA: e.target.value })}
              />
              <TextField
                label="Option B"
                value={rowEditForm.optionB || ''}
                onChange={(e) => setRowEditForm({ ...rowEditForm, optionB: e.target.value })}
              />
              <TextField
                label="Option C"
                value={rowEditForm.optionC || ''}
                onChange={(e) => setRowEditForm({ ...rowEditForm, optionC: e.target.value })}
              />
              <TextField
                label="Option D"
                value={rowEditForm.optionD || ''}
                onChange={(e) => setRowEditForm({ ...rowEditForm, optionD: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Correct Answer (Letter / Value)"
                value={rowEditForm.correctAnswer || ''}
                onChange={(e) => setRowEditForm({ ...rowEditForm, correctAnswer: e.target.value })}
                required
              />
              <TextField
                label="Type"
                value={rowEditForm.type || 'MCQ'}
                onChange={(e) => setRowEditForm({ ...rowEditForm, type: e.target.value })}
              />
            </div>

            <TextArea
              label="Explanation (Steps separated by |)"
              value={rowEditForm.explanation || ''}
              onChange={(e) => setRowEditForm({ ...rowEditForm, explanation: e.target.value })}
              rows={2}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
