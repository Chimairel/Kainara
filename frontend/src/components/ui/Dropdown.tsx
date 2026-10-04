'use client';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Select, type SelectOption } from './Select';

function optionList(children: ReactNode): SelectOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(child)) return [];
    if (child.type === Fragment) return optionList(child.props.children);
    if (child.type !== 'option') return [];
    const label = Children.toArray(child.props.children).join('');
    return [{ value: String(child.props.value ?? label), label, disabled: child.props.disabled }];
  });
}

/** The Progress menu with option children for existing controlled filters. */
export default function Dropdown({
  children,
  value,
  onChange,
  className,
  ...props
}: {
  children: ReactNode;
  value: string | number;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  'aria-label'?: string;
}) {
  return (
    <Select
      {...props}
      value={String(value)}
      onChange={onChange}
      options={optionList(children)}
      triggerClassName={className}
    />
  );
}
