import { CARD_DECORATION_VARIANTS, type CardDecorationVariant } from './CardDecorationVariants';
export type { CardDecorationVariant } from './CardDecorationVariants';
import { KainaraLogo } from '@/components/shared/KainaraLogo';

export type CardDecorationStyle = 'none' | 'stripes' | 'logo' | 'both' | 'varied';

/** A stable seed gives optional decoration without random server/client markup. */
export function resolveCardDecoration(
  style: CardDecorationStyle,
  seed: string
): Exclude<CardDecorationStyle, 'varied'> {
  if (style !== 'varied') return style;
  const hash = Array.from(seed).reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 0);
  return (['none', 'stripes', 'logo', 'both'] as const)[hash % 4];
}

export default function CardDecoration({
  style = 'none',
  seed = '',
  variant = 'default',
}: {
  style?: CardDecorationStyle;
  seed?: string;
  variant?: CardDecorationVariant;
}) {
  if (variant !== 'default')
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit] print:hidden"
        data-card-decoration-variant={variant}
      >
        {CARD_DECORATION_VARIANTS[variant]}
      </div>
    );
  const decoration = resolveCardDecoration(style, seed);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit] print:hidden"
      data-card-decoration={decoration}
    >
      {(decoration === 'stripes' || decoration === 'both') && (
        <svg
          viewBox="0 0 160 160"
          className="absolute -right-0.5 -top-0.5 h-36 w-36 opacity-80 sm:h-48 sm:w-48"
          fill="none"
        >
          <path d="M160,0 L0,0 C20,40 55,95 120,135 C140,147 160,155 160,155 Z" fill="#eb6a38" />
          <path d="M160,0 L40,0 C55,30 80,72 130,105 C145,115 160,120 160,120 Z" fill="#f09e6c" />
          <path d="M160,0 L82,0 C92,20 110,48 142,70 C152,76 160,80 160,80 Z" fill="#1b4e41" />
        </svg>
      )}
      {(decoration === 'logo' || decoration === 'both') && (
        <div className="absolute -bottom-6 -right-6 opacity-10">
          <KainaraLogo size={120} variant="multicolor" />
        </div>
      )}
    </div>
  );
}
