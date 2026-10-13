import { describe, expect, it } from 'vitest';
import { searchDocs } from './docs-search';
import { docsChapters } from './DocsChapters';

describe('documentation search', () => {
  it('finds authored answers and linked text without executing components', () => {
    const matches = searchDocs(docsChapters, 'previous plan');
    expect(matches.flatMap((chapter) => chapter.sections).map((section) => section.id)).toContain('faqs-previous-plan');
    expect(searchDocs(docsChapters, 'contact support').flatMap((chapter) => chapter.sections).map((section) => section.id)).toContain('faqs-support');
  });
  it('normalizes case/spacing and requires all search words', () => {
    expect(searchDocs(docsChapters, '  NOTIFICATIONS   banner  ').flatMap((chapter) => chapter.sections).map((section) => section.id)).toContain('faqs-notifications');
    expect(searchDocs(docsChapters, 'notifications impossibleword')).toHaveLength(0);
    expect(searchDocs(docsChapters, '')).toHaveLength(docsChapters.length);
  });
});
