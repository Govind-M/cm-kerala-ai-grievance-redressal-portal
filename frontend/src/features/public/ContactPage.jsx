import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Input } from '../../components/ui/index.jsx';
import { publicError, submitContact } from '../../services/publicApi.js';
import { PageHeading, pageWidth } from './components.jsx';

const initial = { name: '', email: '', subject: '', message: '', website: '' };
const limits = { name: 150, email: 255, subject: 255, message: 5000 };
const controls = /[\u0000-\u0008\u000b-\u001f\u007f]/;

export default function ContactPage() {
  const [fields, setFields] = useState(initial);
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const submitting = useRef(false);
  const mounted = useRef(true);
  const formRef = useRef(null);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function change(event) {
    const { name, value } = event.target;
    setFields((previous) => ({ ...previous, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting.current || cooldown) return;
    const data = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.replace(/\r\n?/g, '\n').trim()]));
    data.email = data.email.toLowerCase();
    const invalid = {};
    for (const [field, max] of Object.entries(limits)) {
      if (!data[field]) invalid[field] = 'This field is required.';
      else if (data[field].length > max || controls.test(data[field])) invalid[field] = `Use valid text, up to ${max} characters.`;
    }
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) invalid.email = 'Enter a valid email address.';
    setErrors(invalid);
    setError('');
    if (Object.keys(invalid).length) {
      formRef.current?.querySelector(`[name="${Object.keys(invalid)[0]}"]`)?.focus();
      return;
    }
    if (new TextEncoder().encode(JSON.stringify(data)).length > 16384) {
      setError('The message is too large. Please shorten it and try again.');
      return;
    }
    submitting.current = true;
    setPending(true);
    try {
      await submitContact(data);
      if (mounted.current) { setSuccess(true); setFields(initial); }
    } catch (failure) {
      if (!mounted.current) return;
      setError(publicError(failure));
      if (failure.response?.status === 429) {
        const value = failure.response.headers?.['retry-after'];
        const seconds = /^\d+$/.test(String(value)) ? Number(value) : Math.ceil((Date.parse(value) - Date.now()) / 1000);
        setCooldown(Math.min(3600, Math.max(1, Number.isFinite(seconds) ? seconds : 60)));
      }
      if (failure.response?.status === 422 && Array.isArray(failure.response.data?.detail)) {
        setErrors(Object.fromEntries(failure.response.data.detail.filter((item) => Object.hasOwn(limits, item.loc?.[1])).map((item) => [item.loc[1], 'Please check this field.'])));
      }
    } finally {
      submitting.current = false;
      if (mounted.current) setPending(false);
    }
  }

  return <><PageHeading title="Contact Us">Have a question about this demonstration platform? Send a general enquiry. To report an issue for investigation, use the citizen grievance workflow instead.</PageHeading><div className={`${pageWidth} grid gap-8 py-12 lg:grid-cols-[1.6fr_1fr]`}>
    <Card className="p-6 sm:p-8">{success ? <div role="status"><h2 className="text-xl text-slate-900">Thank you for getting in touch.</h2><p className="mt-3 text-slate-600">Your enquiry has been received. Please avoid repeated submissions.</p><p className="mt-3 text-sm text-slate-500">This acknowledgement does not create a grievance or guarantee an email reply.</p></div> : <form ref={formRef} onSubmit={submit} noValidate className="space-y-5" aria-label="Contact enquiry">
      <h2 className="text-xl text-slate-900">Send an enquiry</h2>
      {error && <Alert type="error">{error}{cooldown > 0 && <p className="mt-2">Try again in approximately {Math.ceil(cooldown / 60)} minute(s).</p>}</Alert>}
      <Input id="contact-name" label="Full name" name="name" autoComplete="name" required maxLength={150} value={fields.name} error={errors.name} disabled={pending} onChange={change} />
      <Input id="contact-email" label="Contact email" name="email" type="email" autoComplete="email" required maxLength={255} value={fields.email} error={errors.email} disabled={pending} onChange={change} />
      <Input id="contact-subject" label="Subject" name="subject" required maxLength={255} value={fields.subject} error={errors.subject} disabled={pending} onChange={change} />
      <div className="space-y-1"><label htmlFor="contact-message" className="text-sm font-medium text-slate-700">Message <span aria-hidden="true" className="text-red-500">*</span></label><textarea id="contact-message" name="message" required rows={6} maxLength={5000} value={fields.message} onChange={change} disabled={pending} aria-invalid={!!errors.message} aria-describedby={errors.message ? 'contact-message-error' : 'contact-message-hint'} className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500 ${errors.message ? 'border-red-400' : 'border-slate-300'}`} />{errors.message ? <p role="alert" id="contact-message-error" className="text-xs text-red-600">{errors.message}</p> : <p id="contact-message-hint" className="text-xs text-slate-500">Up to 5,000 characters. Do not include sensitive personal information.</p>}</div>
      <div hidden aria-hidden="true"><label htmlFor="contact-website">Leave this field empty</label><input id="contact-website" name="website" value={fields.website} onChange={change} tabIndex={-1} autoComplete="off" /></div>
      <Button type="submit" loading={pending} disabled={pending || cooldown > 0} size="lg">{pending ? 'Sending enquiry…' : 'Send enquiry'}</Button>
      <p className="text-xs leading-relaxed text-slate-500">No sign-in required. Enquiries are visible only to authorized CMO administrators. Please use fictional information for this prototype.</p>
    </form>}</Card>
    <aside className="space-y-5"><Card className="p-6"><h2 className="text-lg">A question or a grievance?</h2><p className="mt-3 text-sm leading-relaxed text-slate-600">This form is for general enquiries. It does not create a grievance reference, submit evidence or change an existing case.</p></Card><Card className="p-6"><h2 className="text-lg">Contact options</h2><p className="mt-3 text-sm leading-relaxed text-slate-600">No telephone number, office address or guaranteed response time is provided. Use this form for general enquiries.</p></Card></aside>
  </div></>;
}
