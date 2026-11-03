import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Upload, Download, CheckCircle2, XCircle, ArrowLeft, FileSpreadsheet } from 'lucide-react';
import { Card, Button, Alert, Badge } from '@/components/ui';
import { adminApi } from '@/services/api/admin';
import { errorMessage } from '@/services/errors';
import { useDocumentTitle } from '@/hooks/useCommon';
import { AdminPageHeader, AdminTable } from './adminShared';

const MOCK_COLUMNS = ['topicId', 'type', 'difficulty', 'questionText', 'optionA', 'optionB', 'optionC', 'optionD', 'correctAnswer', 'answerTolerance', 'explanation', 'conceptNote'];
const MOCK_TEMPLATE = `${MOCK_COLUMNS.join(',')}
c8_ch02_t1,NUMERIC,EASY,"Solve for $x$: $3x + 4 = 19$",,,,,5,0,"Subtract 4 from both sides: $3x = 15$|Divide by 3: $x = 5$","Keep the equation balanced."
c8_ch05_t2,MCQ_SINGLE,MEDIUM,"Find $\\sqrt{196}$",12,14,16,18,B,0,"$14 \\times 14 = 196$|So $\\sqrt{196} = 14$",
c8_ch05_t2,MCQ_SINGLE,HARD,"This row has no explanation",1,2,3,4,A,0,,`;

// The live backend needs class / chapter / topic ids and its own question types, so it supplies its own spec.
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
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; } else if (c === '"') quoted = false; else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

/** Bulk import with a row-level validation report before commit (F4-01). */
export default function ImportPage() {
  useDocumentTitle('Bulk import');
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [rows, setRows] = useState(null);
  const [report, setReport] = useState(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gyaangrid-question-template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onFile = async (file) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) { toast.error('Please upload a .csv file (save XLSX as CSV first).'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('File must be under 5 MB.'); return; }
    setFileName(file.name);
    const parsed = parseCsv(await file.text());
    if (!parsed.length) { toast.error('No rows found in this file.'); return; }
    setRows(parsed);
    setBusy(true);
    try { setReport(await adminApi.validateImport(parsed)); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const commit = async () => {
    setBusy(true);
    try {
      const res = await adminApi.commitImport(rows);
      toast.success(`${res.imported} questions imported${adminApi.importSpec ? ' as drafts' : ' to the review queue'}. ${res.rejected} rejected.`);
      navigate('/admin/questions');
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const valid = report?.rows.filter((r) => r.valid).length || 0;
  const invalid = (report?.rows.length || 0) - valid;

  return (
    <div>
      <button type="button" onClick={() => navigate('/admin/questions')} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-brand-600"><ArrowLeft className="h-4 w-4" />Question bank</button>
      <AdminPageHeader title="Bulk import questions" subtitle={adminApi.importSpec ? 'Upload a CSV. Every row is validated before anything is saved. Imported questions are saved as drafts — publish them from the question bank.' : 'Upload a CSV. We validate every row before anything is saved. Imported questions go to the review queue.'} action={<Button variant="outline" leftIcon={Download} onClick={downloadTemplate}>Download template</Button>} />
      {SPEC.note && <Alert tone="info" className="mb-4">{SPEC.note}</Alert>}
      <Card className="mb-5">
        <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 py-10 text-ink-500 transition hover:border-brand-300 hover:bg-brand-50/40">
          <FileSpreadsheet className="h-10 w-10 text-brand-500" />
          <span className="font-bold text-ink-800">{fileName || 'Choose a CSV file'}</span>
          <span className="text-xs">Columns: {COLUMNS.join(', ')} · steps separated by “|”</span>
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </Card>
      {report && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Badge tone="success" icon={CheckCircle2}>{valid} valid</Badge>
            <Badge tone="danger" icon={XCircle}>{invalid} with errors</Badge>
            <div className="ml-auto"><Button leftIcon={Upload} disabled={!valid} loading={busy} onClick={commit}>Import {valid} valid rows</Button></div>
          </div>
          {invalid > 0 && <Alert tone="warning" className="mb-4">Rows with errors will be skipped. Fix them in your file and import again.</Alert>}
          <AdminTable
            rowKey={(r) => r.row}
            rows={report.rows}
            columns={[
              { key: 'row', label: 'Row', className: 'w-16 font-mono text-xs' },
              { key: 'status', label: 'Result', render: (r) => (r.valid ? <Badge tone="success">Valid</Badge> : <Badge tone="danger">Error</Badge>) },
              { key: 'topicName', label: 'Topic', className: 'text-xs' },
              { key: 'questionText', label: 'Question', className: 'max-w-xs truncate' },
              { key: 'errors', label: 'Issues', className: 'text-xs text-rose-600', render: (r) => r.errors.join(' · ') || '—' },
            ]}
          />
        </>
      )}
    </div>
  );
}
