'use client';
import type { ReactNode } from 'react';
import { Select, type SelectOption } from '@/components/ui/Select';
import CanvasTooltip from './CanvasTooltip';

/** Reuse the portalled select's keyboard and focus handling for compact canvas menus. */
export default function CanvasMenu({ label, icon, value = '', onSelect, items }: {
  label: string; icon: ReactNode; value?: string; onSelect: (value: string) => void; items: SelectOption[];
}) {
  return <CanvasTooltip label={label}>{descriptionId =>
    <Select aria-label={label} aria-describedby={descriptionId} value={value} onChange={onSelect} options={items} triggerContent={icon}
      className="!w-auto" triggerClassName="!min-h-10 !gap-1 !rounded-lg !border-transparent !bg-transparent !px-2 hover:!bg-brand-green/10"
      menuClassName="min-w-60" />
  }</CanvasTooltip>;
}
