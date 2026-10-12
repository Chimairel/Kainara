import { forwardRef, type ComponentType, type SVGProps } from 'react';
import type { IconProps } from '@solar-icons/react/lib/types';

/** App icon boundary: callers retain layout, color tokens and accessible control labels. */
export type AppIconProps = Omit<SVGProps<SVGSVGElement>, 'ref'> & { size?: string | number };
export type AppIcon = ReturnType<typeof adaptIcon>;
export function adaptIcon(SolarIcon: ComponentType<IconProps>, name: string) {
  const Icon = forwardRef<SVGSVGElement, AppIconProps>(({ size, strokeWidth = 1.7, ...props }, ref) => (
    <SolarIcon
      {...props}
      ref={ref}
      size={size}
      width={size ?? 24}
      height={size ?? 24}
      strokeWidth={strokeWidth}
      secondaryColor="currentColor"
      secondaryOpacity={0.22}
      data-app-icon={name}
    />
  ));
  Icon.displayName = name;
  return Icon;
}
