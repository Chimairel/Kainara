'use client';

import { Camera, X } from '@/components/ui/icons';
import type { useOutsideMealFormModel } from './useOutsideMealFormModel';
type SectionProps = { model: Pick<ReturnType<typeof useOutsideMealFormModel>,
  'fileInputRef' | 'handleImageChange' | 'imagePreview' | 'handleClearImage' | 'imageError' | 'props'> };

export default function OutsideMealPhotoSection({ model }: SectionProps) {
  const { fileInputRef, handleImageChange, imagePreview, handleClearImage, imageError, props } = model;
  return (
    <section className="grid grid-cols-1 gap-4 border-t border-brand-border pt-5 sm:grid-cols-2" aria-label="Optional food details">
      <div className="space-y-2">
        <label htmlFor="mealNotes" className="font-display text-sm font-semibold text-brand-text">Notes (optional)</label>
        <textarea id="mealNotes" rows={3} placeholder="e.g. restaurant, preparation, serving details"
          value={props.notes} onChange={(event) => props.onNotesChange(event.target.value)} disabled={props.isLoading}
          className="min-h-24 w-full resize-y rounded-xl border border-brand-border bg-brand-bgAlt p-3 text-sm text-brand-text placeholder:text-brand-muted outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20" />
      </div>
      <div className="space-y-2">
        <p className="font-display text-sm font-semibold text-brand-text">Photo (optional)</p>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment"
          onChange={handleImageChange} aria-label="Choose a food photo" tabIndex={-1} className="hidden" />
        <div className="relative">
          <button type="button" onClick={() => fileInputRef.current?.click()} aria-label={imagePreview ? 'Replace food photo' : 'Upload Photo or Use Camera (Optional)'}
            className="flex min-h-24 w-full items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed border-brand-border bg-brand-bgAlt p-3 text-left text-sm text-brand-text transition-colors hover:border-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40">
            {imagePreview ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={imagePreview} alt="Meal photo preview" className="h-24 w-full rounded-lg object-cover" />
            ) : <><Camera className="h-5 w-5 shrink-0 text-brand-green" aria-hidden="true" /><span>Upload Photo or Use Camera (Optional)<span className="mt-1 block text-xs text-brand-muted">JPG, PNG or WebP · up to 2 MB</span></span></>}
          </button>
          {imagePreview && <button type="button" onClick={handleClearImage} aria-label="Remove photo"
            className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-brand-surface text-brand-text shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>}
        </div>
        <p className="text-xs leading-relaxed text-brand-muted">Attached to your saved log. Gemini does not analyze the photo.</p>
        {imageError && <p role="alert" className="text-xs text-status-error-text">{imageError}</p>}
      </div>
    </section>
  );
}
