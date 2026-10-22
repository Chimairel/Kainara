import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Keyboard, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { api } from '../../lib/client';
import { useResource } from '../../lib/use-resource';
import type { Allowance, ChatInput, ChatResult, Reply } from '../../lib/contracts';
import { useChatState, emptyChat } from '../../lib/chat-state';
import { useSession } from '../../lib/session';
import { serializeQuestion, validateQuestion } from '../../lib/policies';
import { Button, Copy, Notice, Panel, Screen, openExternal, useAction } from '../../ui/components';
import { useTheme } from '../../ui/theme';
import { webUrl } from '../../lib/web-links';

async function followLink(href: string) {
  const mapped: Record<string, '/' | '/meals' | '/progress' | '/groceries' | '/report' | '/profile'> = {
    '/dashboard': '/',
    '/meals': '/meals',
    '/progress': '/progress',
    '/grocery': '/groceries',
    '/profile/nutrition-report': '/report',
    '/profile': '/profile',
  };
  const path = href.split('?')[0];
  if (mapped[path]) router.push(mapped[path]);
  else if (href.startsWith('/') && !href.startsWith('//')) await openExternal(webUrl(href));
  else await openExternal(href);
}
export default function Nara() {
  const status = useResource<{ enabled: boolean; allowance: Allowance; instantQuestions?: string[] }>(
    '/user/assistant'
  );
  const { state, setState } = useChatState();
  const { profile } = useSession();
  const theme = useTheme();
  const action = useAction();
  const [balance, setBalance] = useState<Allowance | null>(null);
  const [menuDismissed, setMenuDismissed] = useState(false);
  const [selectedPrefix, setSelectedPrefix] = useState(false);
  const [selectionStart, setSelectionStart] = useState(0);
  const [now, setNow] = useState(Date.now);
  const lastBackspace = useRef(0);
  const questionInput = useRef<React.ComponentRef<typeof TextInput>>(null);
  const receiptKey = `kainara.pending.${profile?.id}`;
  const allowance = balance ?? status.data?.allowance;
  const cooldown = Math.max(0, Math.ceil(((Date.parse(allowance?.nextAiRequestAt ?? '') || 0) - now) / 1000));
  const menu = !state.ai && !menuDismissed && /^\/(?:a|ai)?$/i.test(state.draft.trim());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    let alive = true;
    void SecureStore.getItemAsync(receiptKey)
      .then((value) => {
        if (alive && value && /^[a-f\d-]{36}$/i.test(value))
          setState((current) => ({ ...current, recoveryKey: value }));
      })
      .catch(() => action.setError('Could not read the previous request receipt.'));
    return () => {
      alive = false;
    };
  }, [receiptKey, setState]); // eslint-disable-line react-hooks/exhaustive-deps
  function selectAi() {
    setState((current) => ({ ...current, ai: true, draft: '', pending: null }));
    setMenuDismissed(true);
    setSelectedPrefix(false);
    questionInput.current?.focus();
  }
  function edit(value: string) {
    setSelectedPrefix(false);
    setMenuDismissed(false);
    const pasted = value.match(/^\s*\/ai\s+([\s\S]*)$/i);
    setState((current) => ({
      ...current,
      draft: pasted ? pasted[1] : value,
      ai: current.ai || Boolean(pasted),
      pending: null,
    }));
  }
  async function applyResult(result: ChatResult, input: ChatInput, entryId: string) {
    setBalance(result.allowance);
    if (result.confirmationRequired) {
      const question = input.message.replace(/^\s*\/ai\s*/i, '');
      const canonical = serializeQuestion(question, true);
      setState((current) => ({
        ...current,
        ai: true,
        draft: question,
        draftEntryId: entryId,
        pending:
          canonical.length <= 1000
            ? { ...input, message: canonical, allowAi: false, requestKey: result.requestKey }
            : null,
      }));
      if (canonical.length > 1000)
        throw new Error('Adding /ai exceeds the 1,000-character limit. Shorten the question before confirming.');
      return;
    }
    await SecureStore.deleteItemAsync(receiptKey);
    setState((current) => ({
      ...current,
      entries: [
        ...current.entries.filter((entry) => entry.id !== `${input.requestKey}:reply`).slice(-39),
        { id: `${input.requestKey}:reply`, role: 'assistant', text: result.reply.text, reply: result.reply },
      ],
      draft: '',
      ai: false,
      pending: null,
      draftEntryId: null,
      recoveryKey: null,
    }));
  }
  async function send(confirmation = false) {
    if (!state.ai && /^\/(?:a|ai)?$/i.test(state.draft.trim()) && !confirmation) {
      selectAi();
      return;
    }
    if (state.recoveryKey) throw new Error('Check the previous request before sending another.');
    const validation = validateQuestion(state.draft, state.ai);
    if (validation) throw new Error(validation);
    const entryId = state.draftEntryId ?? Crypto.randomUUID();
    const input: ChatInput =
      confirmation && state.pending
        ? { ...state.pending, allowAi: true }
        : {
            requestKey: Crypto.randomUUID(),
            message: serializeQuestion(state.draft, state.ai),
            allowAi: false,
            context: state.entries.slice(-6).map((entry) => ({ role: entry.role, content: entry.text.slice(0, 500) })),
          };
    if (confirmation) {
      if (!state.pending || state.pending.message !== serializeQuestion(state.draft, state.ai))
        throw new Error('Your question changed. Submit it again for fresh confirmation.');
      if (!allowance || allowance.remaining < 1 || cooldown > 0)
        throw new Error('No AI request is available right now. Check credits or wait for the cooldown.');
      await SecureStore.setItemAsync(receiptKey, input.requestKey);
      setState((current) => ({ ...current, recoveryKey: input.requestKey }));
    }
    setState((current) => ({
      ...current,
      draftEntryId: entryId,
      entries: [
        ...current.entries.filter((entry) => entry.id !== entryId).slice(-39),
        { id: entryId, role: 'user', text: state.draft.trim() },
      ],
    }));
    const response = await api.request<ChatResult>('/user/assistant/messages', 'POST', input);
    await applyResult(response.data, input, entryId);
    Keyboard.dismiss();
  }
  async function recover() {
    if (!state.recoveryKey) return;
    const key = state.recoveryKey;
    const response = await api.request<{ status: string; reply?: Reply; allowance: Allowance }>(
      `/user/assistant/requests/${key}`
    );
    setBalance(response.data.allowance);
    if (response.data.status === 'RUNNING')
      throw new Error('Your request is still running. Check again shortly; do not submit another copy.');
    if (response.data.status === 'SUCCEEDED' && response.data.reply) {
      await applyResult(
        { confirmationRequired: false, reply: response.data.reply, allowance: response.data.allowance },
        { requestKey: key } as ChatInput,
        state.draftEntryId ?? key
      );
    } else {
      await SecureStore.deleteItemAsync(receiptKey);
      setState((current) => ({ ...current, recoveryKey: null, pending: null }));
      throw new Error('No completed reply is available. Review your question and submit again for fresh confirmation.');
    }
  }
  return (
    <Screen keyboard>
      <Copy title>Your nutrition companion.</Copy>
      <Copy muted>
        App help and saved-information shortcuts are free. For an AI reply, type /ai, select Ask AI, then write your
        question. I’ll ask before using 1 credit.
      </Copy>
      {status.error ? (
        <Notice error title="Nara could not connect" body={status.error} onRetry={() => void status.reload()} />
      ) : null}
      {status.data && !status.data.enabled ? (
        <Notice title="Nara is unavailable" body="The assistant is not enabled on this server." />
      ) : null}
      {state.entries.map((entry) => (
        <Panel key={entry.id} style={{ backgroundColor: entry.role === 'user' ? theme.greenSoft : theme.surface }}>
          <Copy small muted>
            {entry.role === 'user' ? 'You' : 'Nara'}
          </Copy>
          <Copy selectable>{entry.text}</Copy>
          {entry.reply?.facts?.map((fact, index) => (
            <Copy key={index} small>
              {fact.label}: {fact.value}
            </Copy>
          ))}
          {entry.reply?.links?.map((link, index) => (
            <Button key={index} label={link.label} secondary onPress={() => followLink(link.href)} />
          ))}
          {entry.reply?.references?.map((link, index) => (
            <Button key={index} label={link.label} secondary onPress={() => followLink(link.href)} />
          ))}
          {entry.reply ? (
            <Copy small muted>
              {entry.reply.source === 'AI'
                ? `${entry.reply.creditsUsed} AI credit used`
                : 'System response · No credit used'}
            </Copy>
          ) : null}
        </Panel>
      ))}
      {state.recoveryKey ? (
        <Notice
          title="Check your previous AI request"
          body="Its delivery is uncertain. Check the saved request receipt before trying again."
          onRetry={() => void action.run(recover)}
        />
      ) : null}
      {allowance ? (
        <Copy small muted>
          {allowance.remaining} / {allowance.cap} AI credits · resets{' '}
          {new Date(allowance.resetsAt).toLocaleDateString('en-PH')}
          {cooldown ? ` · wait ${cooldown}s` : ''}
        </Copy>
      ) : null}
      {menu ? <Button label="/ai — Ask AI · 1 credit after confirmation" secondary onPress={selectAi} /> : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 8,
          padding: 16,
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 18,
        }}
      >
        {state.ai ? (
          <Text
            accessibilityLabel={
              selectedPrefix ? 'AI prefix selected. Press Backspace again to remove.' : 'AI mode selected'
            }
            style={{
              color: theme.text,
              fontWeight: '700',
              backgroundColor: selectedPrefix ? theme.primary : theme.greenSoft,
              fontSize: 16,
              lineHeight: 24,
            }}
          >
            /ai
          </Text>
        ) : null}
        <TextInput
          ref={questionInput}
          accessibilityLabel="Your question to Nara"
          value={state.draft}
          onChangeText={edit}
          multiline
          submitBehavior="newline"
          placeholder="Ask about meals or your guidance…"
          placeholderTextColor={theme.muted}
          selectionColor={theme.green}
          editable={!action.busy && !state.recoveryKey}
          onBlur={() => setSelectedPrefix(false)}
          onSelectionChange={(event) => {
            setSelectionStart(event.nativeEvent.selection.start);
            setSelectedPrefix(false);
          }}
          onKeyPress={(event) => {
            const key = event.nativeEvent.key;
            if ((key === 'Enter' || key === 'Tab') && menu) {
              event.preventDefault();
              selectAi();
              return;
            }
            if (key === 'Escape') {
              setMenuDismissed(true);
              return;
            }
            if (key === 'Backspace' && state.ai && selectionStart === 0) {
              const time = Date.now();
              const deliberate = selectedPrefix && time - lastBackspace.current > 350;
              lastBackspace.current = time;
              if (deliberate) {
                setState((current) => ({ ...current, ai: false, pending: null }));
                setSelectedPrefix(false);
                AccessibilityInfo.announceForAccessibility('AI prefix removed.');
              } else {
                setSelectedPrefix(true);
                AccessibilityInfo.announceForAccessibility('AI prefix selected. Press Backspace again to remove.');
              }
            } else {
              setSelectedPrefix(false);
            }
          }}
          style={{
            flex: 1,
            color: theme.text,
            fontSize: 16,
            lineHeight: 24,
            minHeight: 72,
            maxHeight: 180,
            padding: 0,
            textAlignVertical: 'top',
          }}
        />
      </View>
      <Copy small muted>
        {serializeQuestion(state.draft, state.ai).length} / 1,000 characters
        {state.ai ? ' · Backspace twice at the start to leave AI mode.' : ''}
      </Copy>
      {state.pending ? (
        <Panel>
          <Copy style={{ fontWeight: '700' }}>Use 1 AI credit?</Copy>
          <Copy muted>Your question stays editable. Editing requires a new confirmation.</Copy>
          <Button
            label="Confirm 1 credit & ask AI"
            busy={action.busy}
            disabled={!allowance || allowance.remaining < 1 || cooldown > 0}
            onPress={() => action.run(() => send(true))}
          />
          <Button
            label="Cancel request"
            secondary
            disabled={action.busy}
            onPress={() => {
              setState((current) => ({
                ...current,
                entries: current.entries.filter((entry) => entry.id !== current.draftEntryId),
                pending: null,
                draftEntryId: null,
              }));
            }}
          />
        </Panel>
      ) : (
        <Button
          label={menu ? 'Select Ask AI' : 'Send question'}
          disabled={
            !state.draft.trim() ||
            action.busy ||
            !status.data?.enabled ||
            Boolean(state.recoveryKey) ||
            serializeQuestion(state.draft, state.ai).length > 1000
          }
          busy={action.busy}
          onPress={() => action.run(() => send())}
        />
      )}
      {action.error ? <Notice error title="Nara needs your attention" body={action.error} /> : null}
      <Button
        label="Start a new chat"
        secondary
        disabled={action.busy || Boolean(state.recoveryKey)}
        onPress={() => {
          setState(emptyChat);
          action.setError(null);
        }}
      />
      <Copy small muted>
        Submitted messages may be available to administrators for 30 days. Unsent typing is not recorded. Do not share
        passwords or payment details. Clearing this chat does not delete server records.
      </Copy>
    </Screen>
  );
}
