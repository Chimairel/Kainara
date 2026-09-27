'use client';
/* eslint-disable @next/next/no-img-element -- Local data URL preview before upload. */

import { useState } from 'react';

export function PhotoUpload({ value, onChange, error }: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [fileError, setFileError] = useState('');
  const select = (file?: File) => {
    setFileError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setFileError('Choose a JPEG or PNG photo.');
      return;
    }
    if (file.size > 740_000) {
      setFileError('Choose a photo smaller than 740 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onChange(reader.result);
      else setFileError('The photo could not be read.');
    };
    reader.onerror = () => setFileError('The photo could not be read.');
    reader.readAsDataURL(file);
  };
  return <div className="space-y-3 rounded-2xl border border-brand-border p-4">
    <label htmlFor="official-headshot" className="block text-sm font-bold">Recent identity photo</label>
    <p className="text-xs text-brand-muted">Upload a clear, current image of your face. An administrator will compare it with you during your one-on-one video call.</p>
    <input id="official-headshot" type="file" accept="image/jpeg,image/png" onChange={(event) => select(event.target.files?.[0])} className="block w-full text-sm text-brand-text" />
    {value && <div className="flex items-center gap-3"><img src={value} alt="Uploaded identity photo preview" className="h-20 w-20 rounded-xl object-cover" /><button type="button" onClick={() => onChange('')} className="text-xs text-brand-green underline">Remove photo</button></div>}
    {(fileError || error) && <p role="alert" className="text-xs text-status-error-text">{fileError || error}</p>}
  </div>;
}
