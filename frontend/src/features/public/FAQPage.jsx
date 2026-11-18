import { getFaqs } from '../../services/publicApi.js';
import { FAQAccordion, PageHeading, ResourceState, SectionHeading, pageWidth } from './components.jsx';
import { guidanceFaqs } from './content.js';
import useResource from './useResource.js';

export default function FAQPage() {
  const resource = useResource(getFaqs);
  return <><PageHeading title="Frequently asked questions">Understand the process before you begin. Your information stays within the platform's authorized workflow.</PageHeading><div className={`${pageWidth} space-y-12 py-12`}>
    <section><SectionHeading title="From the platform">Published questions maintained by the platform administrators.</SectionHeading><ResourceState resource={resource} empty={!resource.data?.length} label="published FAQs"><FAQAccordion items={resource.data || []} /></ResourceState></section>
    <section><SectionHeading title="Using this demonstration">Maintained guidance based on the implemented workflow, not government policy.</SectionHeading><FAQAccordion items={guidanceFaqs.map(([question, answer], id) => ({ id: `guide-${id}`, question, answer }))} /></section>
  </div></>;
}
