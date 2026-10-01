'use client';
/* eslint-disable @next/next/no-img-element -- Local data URL preview before upload. */

import { useEffect, useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { Camera, ImageUp, Trash2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export function PhotoUpload({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [fileError, setFileError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<FileReader | null>(null);
  const cancelRead = () => {
    const reader = readerRef.current;
    readerRef.current = null;
    reader?.abort();
  };
  useEffect(() => cancelRead, []);

  const processFile = (file?: File) => {
    setFileError('');
    if (!file) return;
    cancelRead();

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setFileError('Please upload a JPEG or PNG photo.');
      return;
    }
    if (file.size > 740_000) {
      setFileError('Photo size exceeds 740 KB. Please upload a smaller image.');
      return;
    }

    const reader = new FileReader();
    readerRef.current = reader;
    reader.onload = () => {
      if (readerRef.current !== reader) return;
      readerRef.current = null;
      if (typeof reader.result === 'string') {
        onChange(reader.result);
      } else {
        setFileError('The photo could not be processed.');
      }
    };
    reader.onerror = () => {
      if (readerRef.current !== reader) return;
      readerRef.current = null;
      setFileError('Error reading photo file.');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    processFile(file);
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    processFile(file);
    e.target.value = '';
  };

  const currentError = fileError || error;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label htmlFor="official-headshot" className="font-display text-xs font-bold text-brand-text/90">
          Recent Identity Photo <span className="text-brand-accent">*</span>
        </label>
        <span className="text-[10px] font-medium text-brand-muted">JPEG or PNG · Max 740 KB</span>
      </div>

      <input
        ref={fileInputRef}
        id="official-headshot"
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {value ? (
        /* Uploaded Preview Card */
        <div className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-4 transition">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-emerald-500/40 shadow-md">
            <img src={value} alt="Uploaded headshot preview" className="h-full w-full object-cover" />
            <div className="absolute bottom-1 right-1 rounded-full bg-emerald-500 p-0.5 text-white shadow">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left">
            <p className="text-xs font-bold text-brand-text">Photo attached</p>
            <p className="mt-0.5 text-[11px] leading-4 text-brand-muted">
              An administrator will compare this photo with you during verification.
            </p>
            <div className="mt-3 flex items-center justify-center sm:justify-start gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-accent hover:underline"
              >
                <RefreshCw className="h-3 w-3" />
                Change photo
              </button>
              <button
                type="button"
                onClick={() => {
                  cancelRead();
                  setFileError('');
                  onChange('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:underline"
              >
                <Trash2 className="h-3 w-3" />
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty Drag & Drop Zone */
        <div
          role="button"
          tabIndex={0}
          aria-label="Choose identity photo"
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
            isDragging
              ? 'border-brand-accent bg-brand-accent/[0.08] scale-[1.01]'
              : currentError
                ? 'border-status-error-text/60 bg-status-error-bg/5 hover:border-status-error-text'
                : 'border-brand-border bg-brand-surface/40 hover:border-brand-accent/60 hover:bg-brand-surface/70'
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-border bg-brand-bg text-brand-muted transition duration-200 group-hover:scale-105 group-hover:border-brand-accent/40 group-hover:text-brand-accent">
            {isDragging ? (
              <ImageUp className="h-6 w-6 text-brand-accent animate-bounce" />
            ) : (
              <Camera className="h-6 w-6" />
            )}
          </div>
          <p className="mt-3 text-xs font-bold text-brand-text">
            Drag and drop your photo here, or <span className="text-brand-accent underline">browse</span>
          </p>
          <p className="mt-1 text-[11px] text-brand-muted">
            Front-facing, clear lighting, taken within the past 30 days
          </p>
        </div>
      )}

      {currentError && (
        <div role="alert" className="flex items-center gap-2 text-xs font-medium text-status-error-text">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{currentError}</span>
        </div>
      )}
    </div>
  );
}
