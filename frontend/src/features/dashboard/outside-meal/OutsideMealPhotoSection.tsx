'use client';

import { Camera, X } from 'lucide-react';

import type { useOutsideMealFormModel } from './useOutsideMealFormModel';
type Model = Extract<ReturnType<typeof useOutsideMealFormModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    'fileInputRef' | 'handleImageChange' | 'imagePreview' | 'handleClearImage' | 'imageError' | 'props'
  >;
};
export default function OutsideMealPhotoSection({ model }: SectionProps) {
  const { fileInputRef, handleImageChange, imagePreview, handleClearImage, imageError, props } = model;

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {/* Photo */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-brand-muted">Photo (optional)</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handleImageChange}
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex h-20 cursor-pointer items-center justify-center rounded-xl border border-dashed border-brand-border/80 bg-brand-surface/40 p-2 text-center transition hover:border-brand-green/60 hover:bg-brand-surface/60 overflow-hidden"
          >
            {imagePreview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Meal photo preview" className="h-full w-full object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white hover:bg-black transition shadow-sm"
                  title="Remove photo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2.5 text-center sm:text-left">
                <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-brand-bgAlt/90 text-brand-muted group-hover:text-brand-green transition">
                  <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] sm:text-xs font-semibold text-brand-text group-hover:text-brand-green transition leading-tight">
                    Upload Photo or Use Camera (Optional)
                  </span>
                  <span className="hidden sm:block text-[10px] text-brand-muted">Tap to capture or upload</span>
                </div>
              </div>
            )}
          </div>
          {imageError && <span className="text-[10px] text-status-error-text">{imageError}</span>}
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label htmlFor="mealNotes" className="text-xs font-semibold text-brand-muted">
            Notes (optional)
          </label>
          <textarea
            id="mealNotes"
            rows={2}
            placeholder="e.g. restaurant, preparation, serving details"
            value={props.notes}
            onChange={(e) => props.onNotesChange(e.target.value)}
            disabled={props.isLoading}
            className="h-20 w-full resize-none rounded-xl border border-brand-border/80 bg-brand-surface/80 p-2.5 text-xs text-brand-text placeholder-brand-muted/60 outline-none transition focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
          />
        </div>
      </div>
    </>
  );
}
