// Presentation-only deduplication of the exact seeded disclosure. Never alter CMS
// records, conceal mixed operational content, or broadly strip disclaimer keywords.
const seededDisclosure = 'This is a recruitment demonstration prototype and is not an official Government of Kerala service.';
export function presentedPage(page) {
  return {
    ...page,
    title: ({ 'About this prototype': 'About the platform', 'Public Grievance Demonstration': 'Public Grievance Redressal' })[page.title] ?? page.title,
    introduction: page.introduction === 'A WhiteMatrix Software Solutions recruitment demonstration, using fictional data.'
      ? 'A citizen-centered approach to transparent, accountable grievance handling.' : page.introduction,
    sections: page.sections.filter((section) => !(section.heading === 'Prototype disclaimer' && section.body?.trim() === seededDisclosure)),
  };
}
