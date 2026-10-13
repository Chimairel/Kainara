import { forwardRef, type ComponentType, type SVGProps } from 'react';
import type { IconProps } from '@solar-icons/react/lib/types';

/** Thick linear Solar strokes; inherit themed control colors and preserve semantic status colors. */
export type AppIconProps = Omit<SVGProps<SVGSVGElement>, 'ref'> & {
  size?: string | number;
  secondaryColor?: string;
  secondaryOpacity?: number;
};
export type AppIcon = ReturnType<typeof adaptIcon>;
export function adaptIcon(SolarIcon: ComponentType<IconProps>, name: string) {
  const Icon = forwardRef<SVGSVGElement, AppIconProps>(
    ({ size, color, strokeWidth = 2.25, secondaryColor, secondaryOpacity, className = '', ...props }, ref) => (
      <SolarIcon
        {...props}
        ref={ref}
        color={color}
        className={`app-icon-linear ${className}`}
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
