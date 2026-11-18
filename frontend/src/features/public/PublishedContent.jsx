import { useCallback } from 'react';
import { Card } from '../../components/ui/index.jsx';
import { getPublicContent } from '../../services/publicApi.js';
import { ResourceState } from './components.jsx';
import useResource from './useResource.js';
import { presentedPage } from './presentation.js';

export default function PublishedContent({ slug }) {
  const load = useCallback((signal) => getPublicContent(slug, signal), [slug]);
  const resource = useResource(load, slug);
  const page = resource.data ? presentedPage(resource.data) : null;
  return <ResourceState resource={resource} empty={!resource.data} label="published page information">
    {resource.data && <Card className="p-6 sm:p-8"><p className="mb-3 text-xs font-semibold uppercase tracking-widest text-teal-700">Published platform information</p><h2 className="text-xl text-slate-900">{page.title}</h2><p className="mt-3 whitespace-pre-line break-words leading-relaxed text-slate-600">{page.introduction}</p><div className="mt-6 space-y-5">{page.sections.map((section, index) => <div key={index}><h3 className="text-base text-slate-800">{section.heading}</h3><p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-slate-600">{section.body}</p></div>)}</div></Card>}
  </ResourceState>;
}
