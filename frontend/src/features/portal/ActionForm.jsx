import { useEffect, useState } from 'react';
import { Alert, Button, Input } from '../../components/ui/index.jsx';
import { ConfirmationDialog, Select, Textarea } from './components.jsx';
import { portalError } from './contracts.js';
import { useMutation } from './hooks.js';

export default function ActionForm({ title, fields, submit, onDone, onPending, initial = {}, validate, children, confirmation = 'Review the information below. This action will be sent to the backend.', reset = true }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [review, setReview] = useState(false);
  const { pending, run } = useMutation();
  useEffect(() => { onPending?.(pending); }, [onPending, pending]);
  function setFieldValue(name, value) {
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next[name];
      return next;
    });
  }
  function prepare(e) {
    e.preventDefault(); setError(''); setSuccess(false);
    const next = {};
    for (const f of fields) {
      const value = String(values[f.name] ?? '').trim();
      if (f.required && !value) next[f.name] = 'This field is required.';
      else if (value && ((f.min && value.length < f.min) || (f.max && value.length > f.max) || value.includes('\0'))) next[f.name] = `Enter ${f.min ?? 1}–${f.max ?? 10000} characters.`;
      else if (f.pattern && value && !f.pattern.test(value)) next[f.name] = 'Enter a valid value.';
    }
    Object.assign(next, validate?.(values) ?? {});
    setErrors(next);
    if (!Object.keys(next).length) setReview(true);
  }
  async function confirm() {
    await run(async () => {
      try {
        const result = await submit(values);
        setReview(false); setSuccess(true);
        if (reset) setValues(initial);
        onDone?.(result);
      } catch (err) {
        setReview(false); setError(portalError(err));
        const invalid = {};
        for (const detail of Array.isArray(err.response?.data?.detail) ? err.response.data.detail : []) {
          const field = detail.loc?.at(-1);
          if (fields.some((f) => f.name === field)) invalid[field] = 'Check this field against its permitted values and length.';
        }
        setErrors(invalid);
      }
    });
  }
  return <div className="space-y-4">{error && <Alert type="error">{error}</Alert>}{success && <p role="status" className="text-sm text-teal-700">Action confirmed by the server.</p>}<form onSubmit={prepare} noValidate className="space-y-4"><fieldset disabled={pending} className="min-w-0 space-y-4">{fields.map((f) => {
    const common = { label: f.label, value: values[f.name] ?? '', onChange: (e) => setFieldValue(f.name, e.target.value), required: f.required, error: errors[f.name] };
    return f.options ? <Select key={f.name} {...common} options={f.options} empty={f.empty ?? 'Choose…'} /> : f.type === 'textarea' ? <Textarea key={f.name} {...common} maxLength={f.max} /> : <Input key={f.name} {...common} type={f.type ?? 'text'} maxLength={f.max} hint={f.hint} />;
  })}{typeof children === 'function' ? children(values, setValues, setFieldValue) : children}<Button type="submit" loading={pending}>{title}</Button></fieldset></form>{review && <ConfirmationDialog title={`Confirm: ${title}`} pending={pending} onCancel={() => setReview(false)} onConfirm={confirm}><p>{confirmation}</p><dl className="space-y-3">{fields.filter((f) => values[f.name]).map((f) => <div key={f.name}><dt className="font-medium">{f.label}</dt><dd className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-slate-600">{f.options?.find((o) => o.value === values[f.name])?.label ?? values[f.name]}</dd></div>)}</dl></ConfirmationDialog>}</div>;
}
