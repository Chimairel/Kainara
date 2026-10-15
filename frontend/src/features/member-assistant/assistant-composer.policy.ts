export function formatAiDraft(value: string) {
  return /^\/ai(?:\s|$)/i.test(value.trim()) ? `/ai ${value.trimStart().slice(3).trimStart()}` : `/ai ${value}`;
}

/** Commands select routing; conversation text contains only the member's question. */
export function assistantQuestionText(value: string) {
  return /^\/ai(?:\s|$)/i.test(value.trimStart()) ? value.trimStart().slice(3).trimStart() : value;
}

/** Radix checks Escape during capture, before the textarea's popup handler. */
export function preserveComposerEscape(event: KeyboardEvent) {
  if (event.target instanceof Element && event.target.matches('[data-nara-composer]')
    && (event.target.getAttribute('aria-expanded') === 'true' || event.target.hasAttribute('data-nara-command-selected'))) event.preventDefault();
}
