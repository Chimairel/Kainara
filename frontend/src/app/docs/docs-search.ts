import { isValidElement, type ReactNode } from 'react';
import type { DocsChapter } from './chapters/chapter-types';

/** Index authored text only. Components are never executed by search. */
export function docsText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(docsText).join(' ');
  if (isValidElement<{ children?: ReactNode }>(node)) return docsText(node.props.children);
  return '';
}
export function searchDocs(chapters: DocsChapter[], query: string) {
  const words = query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return chapters.map((chapter) => ({ ...chapter, sections: chapter.sections.filter((section) => {
    const text = [chapter.title, chapter.shortTitle, docsText(chapter.summary), section.title, docsText(section.content), section.searchText ?? '']
      .join(' ').normalize('NFKC').toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  }) })).filter((chapter) => chapter.sections.length > 0);
}
