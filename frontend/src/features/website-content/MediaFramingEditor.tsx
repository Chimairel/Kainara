'use client';

import Button from '@/components/ui/Button';
import NativeSelect from '@/components/ui/NativeSelect';
import { DEFAULT_MEDIA_FRAMING, type MediaFraming } from './types';

export default function MediaFramingEditor({
  value,
  onChange,
  disabled,
}: {
  value: MediaFraming;
  onChange: (value: MediaFraming) => void;
  disabled: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="space-y-4 border-t border-brand-border pt-5">
      <legend className="px-0 pt-5 font-semibold">Image framing</legend>
      <p className="text-sm text-brand-muted">
        Adjust the draft preview before publishing. The original upload is kept.
      </p>
      <label className="block text-sm font-semibold">
        Image fit
        <NativeSelect
          className="mt-2"
          value={value.fit}
          onChange={(event) => onChange({ ...value, fit: event.target.value as MediaFraming['fit'] })}
        >
          <option value="cover">Fill frame · crop edges</option>
          <option value="contain">Show whole image</option>
        </NativeSelect>
      </label>
      {(['x', 'y'] as const).map((axis) => (
        <label key={axis} className="block text-sm font-semibold">
          {axis === 'x' ? 'Horizontal position' : 'Vertical position'}{' '}
          <span className="font-normal tabular-nums text-brand-muted">{value[axis]}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={value[axis]}
            aria-label={axis === 'x' ? 'Horizontal position' : 'Vertical position'}
            onChange={(event) => onChange({ ...value, [axis]: Number(event.target.value) })}
            className="mt-2 block h-11 w-full cursor-pointer accent-brand-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green"
          />
          <span className="flex justify-between text-xs font-normal text-brand-muted">
            <span>{axis === 'x' ? 'Left' : 'Top'}</span>
            <span>{axis === 'x' ? 'Right' : 'Bottom'}</span>
          </span>
        </label>
      ))}
      <Button type="button" variant="secondary" onClick={() => onChange({ ...DEFAULT_MEDIA_FRAMING })}>
        Reset framing
      </Button>
    </fieldset>
  );
}
