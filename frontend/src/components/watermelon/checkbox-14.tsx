'use client';

import React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

export type Checkbox14Color = 'emerald' | 'coral' | 'blue';

export interface CircularCheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  colorVariant?: Checkbox14Color;
  size?: 'sm' | 'md' | 'lg';
}

const colorStyles: Record<Checkbox14Color, { checked: string; border: string }> = {
  emerald: {
    checked: 'data-[state=checked]:bg-brand-green data-[state=checked]:border-brand-green dark:data-[state=checked]:bg-brand-accent dark:data-[state=checked]:border-brand-accent',
    border: 'hover:border-brand-green/60 focus-visible:ring-brand-green/20',
  },
  coral: {
    checked: 'data-[state=checked]:bg-[#eb6a38] data-[state=checked]:border-[#eb6a38]',
    border: 'hover:border-[#eb6a38]/60 focus-visible:ring-[#eb6a38]/20',
  },
  blue: {
    checked: 'data-[state=checked]:bg-[#18b9d2] data-[state=checked]:border-[#18b9d2]',
    border: 'hover:border-[#18b9d2]/60 focus-visible:ring-[#18b9d2]/20',
  },
};

const sizeStyles = {
  sm: { box: 'h-4 w-4', icon: 'h-2.5 w-2.5 stroke-[3]' },
  md: { box: 'h-5 w-5', icon: 'h-3.5 w-3.5 stroke-[3]' },
  lg: { box: 'h-6 w-6', icon: 'h-4 w-4 stroke-[3]' },
};

export const CircularCheckbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CircularCheckboxProps
>(({ className = '', colorVariant = 'emerald', size = 'md', ...props }, ref) => {
  const color = colorStyles[colorVariant] || colorStyles.emerald;
  const s = sizeStyles[size] || sizeStyles.md;

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={`peer ${s.box} shrink-0 rounded-full border-[1.5px] border-brand-border bg-brand-surface/90 dark:bg-black/30 shadow-2xs outline-none transition-all duration-150 hover:scale-105 active:scale-95 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-30 ${color.checked} ${color.border} ${className}`}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
        <Check className={s.icon} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
CircularCheckbox.displayName = 'CircularCheckbox';

export default function Checkbox14() {
  const [checkedItems, setCheckedItems] = React.useState<Record<string, boolean>>({
    coral: true,
    blue: true,
    emerald: true,
  });

  return (
    <div className="flex items-center gap-3">
      {(['coral', 'blue', 'emerald'] as const).map((color) => (
        <CircularCheckbox
          key={color}
          colorVariant={color}
          checked={checkedItems[color]}
          onCheckedChange={(checked) =>
            setCheckedItems((prev) => ({ ...prev, [color]: Boolean(checked) }))
          }
          aria-label={`Toggle ${color} checkbox`}
        />
      ))}
    </div>
  );
}
