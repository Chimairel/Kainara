export function formatAiDraft(value: string) {
  return /^\/ai(?:\s|$)/i.test(value.trim()) ? `/ai ${value.trimStart().slice(3).trimStart()}` : `/ai ${value}`;
}

/** Radix checks Escape during capture, before the textarea's popup handler. */
export function preserveComposerEscape(event: KeyboardEvent) {
  if (event.target instanceof Element && event.target.matches('[data-nara-composer]')
    && (event.target.getAttribute('aria-expanded') === 'true' || event.target.hasAttribute('data-nara-command-selected'))) event.preventDefault();
}
