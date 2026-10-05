import { KainaraLogo } from '@/components/shared/KainaraLogo';

/** Fixed brand accents from each original design. Generic decorations remain optional. */
export const CARD_DECORATION_VARIANTS = {
  intake: (
    <>
      {/* Retro Wave Organic Corner Accent (Top Right) - Connected with On your menu card */}
      <div className="pointer-events-none absolute -top-0.5 -right-0.5 h-32 w-32 overflow-hidden rounded-tr-3xl z-0">
        <svg viewBox="0 0 160 160" className="h-full w-full" fill="none" aria-hidden="true">
          <path d="M160,0 L0,0 C20,40 55,95 120,135 C140,147 160,155 160,155 Z" fill="#eb6a38" />
          <path d="M160,0 L40,0 C55,30 80,72 130,105 C145,115 160,120 160,120 Z" fill="#f09e6c" />
          <path
            d="M160,0 L82,0 C92,20 110,48 142,70 C152,76 160,80 160,80 Z"
            className="fill-[#1b4e41] dark:fill-[#164639]"
          />
        </svg>
      </div>
    </>
  ),
  grocery: (
    <>
      {/* Retro Wave Organic Corner Accent (Top Left) */}
      <div className="pointer-events-none absolute -top-0.5 -left-0.5 h-28 w-28 sm:h-32 sm:w-32 overflow-hidden rounded-tl-[28px] sm:rounded-tl-[32px] z-0">
        <svg viewBox="0 0 160 160" className="h-full w-full" fill="none">
          <path d="M0,0 L160,0 C140,40 105,95 40,135 C20,147 0,155 0,155 Z" fill="#eb6a38" />
          <path d="M0,0 L120,0 C105,30 80,72 30,105 C15,115 0,120 0,120 Z" fill="#f09e6c" />
          <path d="M0,0 L78,0 C68,20 50,48 18,70 C8,76 0,80 0,80 Z" className="fill-[#1b4e41] dark:fill-[#164639]" />
        </svg>
      </div>

      {/* Bottom Right Decorative Watermark */}
      <div className="pointer-events-none absolute -bottom-8 -right-8 flex items-center justify-center opacity-10 dark:opacity-15 z-0">
        <KainaraLogo size={140} variant="multicolor" />
      </div>
    </>
  ),
  membership: (
    <>
      {/* 1. Retro Wave Organic Corner Accent (3-Tone Signature Curved Stripes from Landing Page) */}
      <div className="pointer-events-none absolute -top-0.5 -right-0.5 h-36 w-36 sm:h-48 sm:w-48 overflow-hidden rounded-tr-[28px] sm:rounded-tr-[36px] z-0 opacity-85">
        <svg viewBox="0 0 160 160" className="h-full w-full" fill="none">
          <path d="M160,0 L0,0 C20,40 55,95 120,135 C140,147 160,155 160,155 Z" fill="#eb6a38" />
          <path d="M160,0 L40,0 C55,30 80,72 130,105 C145,115 160,120 160,120 Z" fill="#f09e6c" />
          <path
            d="M160,0 L82,0 C92,20 110,48 142,70 C152,76 160,80 160,80 Z"
            className="fill-[#1b4e41] dark:fill-[#164639]"
          />
        </svg>
      </div>

      {/* 2. Soft Ambient Radial Glow (from Landing Page) */}
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-72 w-72 rounded-full bg-brand-green/10 blur-[100px] z-0" />

      {/* 3. Subtle Watermarked Kainara Logo Seal (from Landing Page) */}
      <div className="pointer-events-none absolute -bottom-6 -right-6 hidden sm:flex items-center justify-center opacity-10 dark:opacity-15 z-0">
        <KainaraLogo size={130} variant="multicolor" />
      </div>
    </>
  ),
  application: (
    <>
      {/* Brand Retro Wave Corner Accent (Matching landing page style) */}
      <div className="pointer-events-none absolute -top-0.5 -right-0.5 h-36 w-36 overflow-hidden rounded-tr-[32px] z-0 opacity-80">
        <svg viewBox="0 0 160 160" className="h-full w-full" fill="none">
          <path d="M160,0 L0,0 C20,40 55,95 120,135 C140,147 160,155 160,155 Z" fill="#eb6a38" />
          <path d="M160,0 L40,0 C55,30 80,72 130,105 C145,115 160,120 160,120 Z" fill="#f09e6c" />
          <path d="M160,0 L82,0 C92,20 110,48 142,70 C152,76 160,80 160,80 Z" className="fill-[#1b4e41]" />
        </svg>
      </div>

      {/* Watermark Logo */}
      <div className="pointer-events-none absolute -bottom-8 -right-8 hidden lg:flex items-center justify-center opacity-10">
        <KainaraLogo size={140} variant="multicolor" />
      </div>
    </>
  ),
  report: (
    <>
      {/* 1. Retro Wave Organic Corner Accent (3-Tone Signature Curved Stripes from Landing Page / Health Membership Card) */}
      <div className="pointer-events-none absolute -top-0.5 -right-0.5 h-36 w-36 sm:h-52 sm:w-52 overflow-hidden rounded-tr-[28px] sm:rounded-tr-[36px] z-0 opacity-85 print:hidden">
        <svg viewBox="0 0 160 160" className="h-full w-full" fill="none">
          <path d="M160,0 L0,0 C20,40 55,95 120,135 C140,147 160,155 160,155 Z" fill="#eb6a38" />
          <path d="M160,0 L40,0 C55,30 80,72 130,105 C145,115 160,120 160,120 Z" fill="#f09e6c" />
          <path
            d="M160,0 L82,0 C92,20 110,48 142,70 C152,76 160,80 160,80 Z"
            className="fill-[#1b4e41] dark:fill-[#164639]"
          />
        </svg>
      </div>

      {/* 2. Soft Ambient Radial Glow */}
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-80 w-80 rounded-full bg-brand-green/10 blur-[100px] z-0 print:hidden" />

      {/* 3. Subtle Watermarked Kainara Logo Seal */}
      <div className="pointer-events-none absolute -bottom-8 -right-8 hidden sm:flex items-center justify-center opacity-10 dark:opacity-15 z-0 print:hidden">
        <KainaraLogo size={160} variant="multicolor" />
      </div>
    </>
  ),
  statistics: (
    <>
      {/* 3. Watermarked Kainara Logo Seal */}
      <div className="pointer-events-none absolute -bottom-6 -right-6 hidden sm:flex items-center justify-center opacity-10 dark:opacity-15 z-0">
        <KainaraLogo size={120} variant="multicolor" />
      </div>
    </>
  ),
  schedule: (
    <>
      {/* 3. Watermarked Kainara Logo Seal */}
      <div className="pointer-events-none absolute -bottom-6 -right-6 hidden sm:flex items-center justify-center opacity-10 dark:opacity-15 z-0">
        <KainaraLogo size={120} variant="multicolor" />
      </div>
    </>
  ),
};

export type CardDecorationVariant = 'default' | keyof typeof CARD_DECORATION_VARIANTS;
