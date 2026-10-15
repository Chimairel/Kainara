'use client';

import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { ArrowUp, MessageSquare } from '@/components/ui/icons';
import { formatAiDraft } from './assistant-composer.policy';

export default function AssistantComposer({ id, draft, onChange, onSend, disabled, sendBlocked, cooldownBlocked }: {
  id: string; draft: string; onChange: (value: string) => void; onSend: () => void;
  disabled: boolean; sendBlocked: boolean; cooldownBlocked: boolean;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const active = /^\/ai\s/i.test(draft);
  const body = active ? draft.slice(4) : draft;
  const [dismissed, setDismissed] = useState(false);
  const [selected, setSelected] = useState(false);
  const armed = useRef(false);
  const keyDelete = useRef(false);
  const selection = useRef([0, 0]);
  const [announcement, setAnnouncement] = useState('');
  const menu = !active && !disabled && !dismissed && /^\/(?:a|ai)?$/i.test(draft.trimStart());
  const tooLong = draft.length > 1000;
  const clearSelection = () => { armed.current = false; setSelected(false); };
  const removeStep = () => {
    if (armed.current) {
      clearSelection(); onChange(body); setAnnouncement('AI removed. Your question is unchanged.');
    } else {
      armed.current = true; setSelected(true);
      setAnnouncement('AI selected. Press Backspace again to remove /ai. Your question will stay.');
    }
  };
  const selectAi = () => { onChange('/ai '); setDismissed(true); };
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    armed.current = false; setSelected(false);
    if (active) {
      setAnnouncement('AI enabled. A credit confirmation is required before sending.');
      input.current?.focus(); input.current?.setSelectionRange(input.current.value.length, input.current.value.length);
    }
  }, [active]);
  useEffect(() => { armed.current = false; setSelected(false); }, [draft]);
  // Native beforeinput covers virtual keyboards that do not emit Backspace keydown.
  // A handled hardware keydown must not count again as a second deletion.
  useEffect(() => {
    const node = input.current;
    if (!node) return;
    const before = (event: InputEvent) => {
      if (disabled || event.isComposing || event.inputType !== 'deleteContentBackward'
        || !active || node.selectionStart !== 0 || node.selectionEnd !== 0) return;
      event.preventDefault();
      if (!keyDelete.current) removeStep();
    };
    node.addEventListener('beforeinput', before);
    return () => node.removeEventListener('beforeinput', before);
  });
  return <div className="relative">
    {menu ? <div id={`${id}-commands`} role="listbox" aria-label="Nara commands"
      className="absolute bottom-full z-10 mb-2 w-full overflow-hidden rounded-xl border border-brand-border bg-brand-surface shadow-card-lg">
      <button type="button" role="option" aria-selected="true" id={`${id}-ai-option`}
        onPointerDown={event => event.preventDefault()} onMouseDown={event => event.preventDefault()} onClick={selectAi}
        className="flex min-h-14 w-full items-center gap-3 bg-brand-bgAlt px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green">
        <MessageSquare aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-green" />
        <span className="min-w-0"><span className="block text-sm font-semibold">/ai — Ask AI</span>
          <span className="mt-1 block text-xs text-brand-muted">1 credit after confirmation</span></span>
      </button>
    </div> : null}
    <form onSubmit={event => { event.preventDefault(); if (menu) selectAi(); else if (!sendBlocked && !cooldownBlocked && !tooLong && body.trim()) onSend(); }}
      className="nara-composer flex items-end gap-2 rounded-2xl border border-brand-border bg-brand-bg p-2 focus-within:border-brand-muted">
      {active ? <span data-nara-ai-chip aria-hidden="true"
        className={`mb-6 mt-2 shrink-0 rounded-md border px-2 py-0.5 text-sm font-semibold ${selected ? 'border-brand-green bg-brand-green text-brand-surface' : 'border-brand-border bg-brand-bgAlt text-brand-green'}`}>/ai</span> : null}
      <label htmlFor={`${id}-input`} className="sr-only">Message the assistant</label>
      <textarea data-nara-composer ref={input} id={`${id}-input`} value={body} disabled={disabled} rows={2}
        data-nara-command-selected={selected || undefined}
        maxLength={active ? 996 : 1000} placeholder="Ask about meals or your guidance…"
        role="combobox" aria-autocomplete="list" aria-expanded={menu} aria-controls={menu ? `${id}-commands` : undefined}
        aria-activedescendant={menu ? `${id}-ai-option` : undefined} aria-describedby={`${id}-command-help`}
        aria-invalid={tooLong || undefined}
        onChange={event => {
          clearSelection(); setDismissed(false);
          const value = event.target.value;
          onChange(active || /^\/ai\s/i.test(value.trimStart()) ? formatAiDraft(value) : value);
        }}
        onFocus={() => setDismissed(false)}
        onPointerDown={clearSelection} onBlur={() => { clearSelection(); keyDelete.current = false; setDismissed(true); }}
        onSelect={event => {
          const node = event.currentTarget; const next = [node.selectionStart, node.selectionEnd];
          if (next.some((value, index) => value !== selection.current[index])) clearSelection();
          selection.current = next;
        }}
        onKeyUp={event => { if (event.key === 'Backspace') keyDelete.current = false; }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Backspace' && active && event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0) {
            event.preventDefault(); keyDelete.current = true; selection.current = [0, 0];
            if (!event.repeat) removeStep();
            return;
          }
          clearSelection();
          if (menu && ['Tab', 'Enter', 'ArrowDown', 'ArrowUp'].includes(event.key) && !event.shiftKey) {
            event.preventDefault(); if (event.key === 'Tab' || event.key === 'Enter') selectAi(); return;
          }
          if (event.key === 'Escape' && (menu || selected)) { event.preventDefault(); setDismissed(true); return; }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (!sendBlocked && !cooldownBlocked && !tooLong && body.trim() && !/^\/ai$/i.test(body.trim())) onSend();
          }
        }}
        className="max-h-36 min-h-14 min-w-0 flex-1 resize-none border-0 bg-transparent p-2 text-sm leading-6 text-brand-text outline-none placeholder:text-brand-muted disabled:opacity-50" />
      <Button type="submit" size="sm" disabled={sendBlocked || cooldownBlocked || tooLong || !body.trim() || menu || /^\/ai$/i.test(body.trim())}
        aria-label="Send message" className="!h-10 !w-10 !min-w-10 !rounded-xl !p-0"><ArrowUp className="h-5 w-5" /></Button>
    </form>
    <p id={`${id}-command-help`} className="mt-2 text-[11px] leading-4 text-brand-muted">{tooLong
      ? 'Shorten your question to 1,000 characters including /ai. Your text has not been cut.'
      : selected ? 'Press Backspace again to remove /ai. Your question will stay.'
        : active ? 'AI selected · 1 credit after confirmation. Backspace twice at the start removes /ai.'
          : 'Type / for commands. App help and saved-information shortcuts are free.'}</p>
    {announcement ? <span role="status" aria-live="polite" className="sr-only">{announcement}</span> : null}
  </div>;
}
