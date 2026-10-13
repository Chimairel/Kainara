import { forwardRef, type ComponentType, type SVGProps } from 'react';
import type { IconProps } from '@solar-icons/react/lib/types';

/** Shared dimensions and accessible labels; theme accents apply to duotone icons, while status symbols retain their meaning. */
export type AppIconProps = Omit<SVGProps<SVGSVGElement>, 'ref'> & {
  size?: string | number;
  secondaryColor?: string;
  secondaryOpacity?: number;
};
export type AppIcon = ReturnType<typeof adaptIcon>;
export function adaptIcon(SolarIcon: ComponentType<IconProps>, name: string, tone: 'solid' | 'duotone' = 'solid') {
  const Icon = forwardRef<SVGSVGElement, AppIconProps>(
    ({ size, color, strokeWidth = 1.7, secondaryColor, secondaryOpacity, className = '', ...props }, ref) => (
      <SolarIcon
        {...props}
        ref={ref}
        color={color ?? (tone === 'duotone' ? 'var(--app-icon-primary, var(--brand-green))' : undefined)}
        className={`${tone === 'duotone' ? 'app-icon-filled app-icon-duotone ' : 'app-icon-filled '}${className}`}
        size={size}
        width={size ?? 24}
        height={size ?? 24}
        strokeWidth={strokeWidth}
        secondaryColor={secondaryColor}
        secondaryOpacity={secondaryOpacity}
        data-app-icon={name}
      />
    )
  );
  Icon.displayName = name;
  return Icon;
}
