import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Input } from '../../components/ui/index.jsx';
import { listAttachments, signedDownload, uploadAttachment } from '../../services/evidenceApi.js';
import { ResourceState, Section } from './components.jsx';
import { portalError } from './contracts.js';
import { useMutation, usePortalResource } from './hooks.js';

export function fileError(file) {
  const types = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  if (!file || !file.size || file.size > 5 * 1024 * 1024) return 'Choose a nonempty file up to 5 MiB (default server limit).';
  if (file.name.length > 255 || /[\u0000-\u001f\u007f]/.test(file.name) || types[file.name.split('.').at(-1).toLowerCase()] !== file.type) return 'Choose a PDF, JPEG, PNG or WebP file with the matching type.';
  return '';
}
function Download({ attachment }) {
  const [link, setLink] = useState(null);
  const [error, setError] = useState('');
  const { pending, run } = useMutation();
  useEffect(() => {
    if (!link) return;
    const timeout = setTimeout(() => setLink(null), Math.max(0, link.until - Date.now()));
    return () => clearTimeout(timeout);
  }, [link]);
  return <div className="flex flex-wrap items-center gap-2"><span className="break-all text-sm">{attachment.original_filename} · {Math.ceil(attachment.file_size / 1024)} KiB</span><Button type="button" variant="secondary" size="sm" loading={pending} onClick={() => run(async () => { setLink(null); setError(''); try { const response = await signedDownload(attachment.id); const url = new URL(response.url); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); setLink({ url: url.href, until: Date.now() + response.expires_in * 1000 }); } catch (err) { setError(portalError(err)); } })}>Prepare download</Button>{link && link.until > Date.now() && <a className="text-sm text-teal-700 underline" href={link.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open short-lived download</a>}{error && <Alert type="error">{error}</Alert>}</div>;
}
export default function EvidencePanel({ id, canUpload = false, reportAttachments = [] }) {
  const load = useCallback((signal) => listAttachments(id, signal), [id]);
  const resource = usePortalResource(load, `evidence:${id}`);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);
  const [message, setMessage] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const { pending, run } = useMutation();
  return <Section title="Evidence attachments"><ResourceState resource={resource}>{(rows) => <ul className="space-y-3">{[...rows, ...reportAttachments.filter((a) => a.report_id)].map((a) => a.report_id ? <li key={a.id} className="text-sm">{a.original_filename} — report-linked metadata only; download is not supported by this evidence API.</li> : <li key={a.id}><Download attachment={a} /></li>)}{!rows.length && !reportAttachments.length && <li className="text-sm text-slate-500">No evidence uploaded.</li>}</ul>}</ResourceState>{canUpload && <div className="space-y-3 border-t border-slate-100 pt-4"><p className="text-sm text-slate-500">Optional: PDF/JPEG/PNG/WebP, default 5 MiB each and 5 files per grievance. Server configuration and signature validation are authoritative. Evidence is retained; deletion is not supported.</p><Input label="Select evidence file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={pending} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setMessage(''); setError(''); }} />{file && <p className="text-sm">Selected: {file.name}</p>}{error && <Alert type="error">{error}</Alert>}{message && <p role="status" className="text-sm text-teal-700">{message}</p>}{pending && progress !== null && <progress aria-label="Upload progress" max="100" value={progress} />}{uncertain && <Button type="button" variant="secondary" disabled={pending || resource.loading} onClick={() => { resource.retry(); setUncertain(false); }}>Reload attachment list before retry</Button>}<Button type="button" loading={pending} disabled={!file || uncertain || resource.loading || !!resource.error || (resource.data?.length ?? 0) >= 5} onClick={() => { const invalid = fileError(file); if (invalid) { setError(invalid); return; } run(async () => { setError(''); setProgress(0); try { await uploadAttachment(id, file, (event) => setProgress(event.total ? Math.round(event.loaded / event.total * 100) : null)); setMessage('Evidence uploaded. Your grievance reference is unchanged.'); setFile(null); resource.retry(); } catch (err) { setError(`${portalError(err)} Your grievance remains submitted. Check the attachment list before retrying an uncertain upload.`); setUncertain(true); } }); }}>Upload selected evidence</Button></div>}</Section>;
}
