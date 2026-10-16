'use client';
import { useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';

export type BatchPreview = {
  previewId: string | null;
  valid: boolean;
  alreadyImported: boolean;
  results: { index: number; mealName: string | null; errors: string[] }[];
};
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
export function useAdminMealBatch(active: boolean) {
  const ownerId = useAuth().user?.userId;
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('meals.json');
  const [preview, setPreview] = useState<BatchPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const busyRef = useRef(false);
  const revision = useRef(0);
  const library = useSessionQuery<{ meals: { id: string; mealName: string }[]; total: number }>({
    ownerId,
    enabled: active,
    resource: `admin-batch-library:${page}`,
    fetcher: async () => (await api.get('/admin/library', { params: { page, limit: 20 } })).data.data,
    errorMessage: 'Meal selection could not be loaded.',
  });
  function edit(value: string) {
    revision.current++;
    setText(value);
    setPreview(null);
    setError(null);
    setMessage('');
  }
  async function upload(file?: File) {
    if (!file || busyRef.current) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('JSON batches are limited to 2 MB. Choose a smaller file.');
      return;
    }
    const ticket = ++revision.current;
    try {
      const value = await file.text();
      if (ticket !== revision.current) return;
      edit(value);
      setFileName(file.name);
    } catch {
      if (ticket === revision.current) setError('This file could not be read. Choose it again or paste the JSON.');
    }
  }
  function format() {
    try {
      edit(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      setError('The JSON cannot be formatted yet. Check commas, quotation marks and brackets.');
    }
  }
  async function run(action: 'template' | 'export' | 'preview' | 'import' | 'insert-template') {
    if (busyRef.current) return;
    const ticket = ++revision.current;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      if (action === 'template' || action === 'insert-template') {
        const value = (await api.get('/admin/meals/batch/template')).data.data;
        if (action === 'template') download(value, 'kainara-meal-template.json');
        else {
          edit(JSON.stringify(value, null, 2));
          setFileName('meals.json');
        }
      }
      if (action === 'export')
        download(
          (await api.post('/admin/meals/batch/export', { ids: selected })).data.data,
          'kainara-selected-meals.json'
        );
      if (action === 'preview') {
        if (new Blob([text]).size > 2 * 1024 * 1024) {
          setError('JSON batches are limited to 2 MB. Split the batch into smaller files.');
          return;
        }
        setPreview(null);
        const result = (await api.post('/admin/meals/batch/preview', JSON.parse(text))).data.data as BatchPreview;
        if (ticket === revision.current) setPreview(result);
      }
      if (action === 'import' && preview?.valid && preview.previewId && !preview.alreadyImported) {
        const result = (await api.post('/admin/meals/batch/import', { previewId: preview.previewId })).data.data;
        setMessage(
          result.replayed
            ? 'This batch was already imported. No duplicate drafts were created.'
            : `${result.meals.length} unverified drafts imported. RND review is required before member use.`
        );
        setPreview({ ...preview, alreadyImported: true });
        await library.refetch();
      }
    } catch (err) {
      setError(
        err instanceof SyntaxError
          ? `Invalid JSON. ${err.message}`
          : getApiErrorMessage(err, 'Batch operation failed. No partial import was committed.')
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return {
    page,
    setPage,
    selected,
    setSelected,
    text,
    edit,
    fileName,
    preview,
    busy,
    error,
    message,
    library,
    upload,
    format,
    run,
  };
}
