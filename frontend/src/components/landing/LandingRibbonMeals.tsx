'use client';

import { useId } from 'react';

/** Decorative dishes use the ribbon's coordinates, so they stay on its curve as it resizes. */
export default function LandingRibbonMeals() {
  const id = useId();
  return (
    <g data-ribbon-meals pointerEvents="none">
      <defs>
        <filter id={`${id}-bowl-shadow`} x="-30%" y="-30%" width="160%" height="170%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="4" dy="7" stdDeviation="4" floodColor="#071914" floodOpacity=".28" />
        </filter>
        <symbol id={`${id}-reference-bowl`} viewBox="0 0 160 110">
          <path d="M12 34C12 8 148 8 148 34V46C144 74 113 86 80 86S16 74 12 46Z" fill="#fff" />
          <ellipse cx="80" cy="34" rx="68" ry="26" fill="#fff" />
          <ellipse cx="80" cy="29" rx="49" ry="13" fill="#ac783f" />
          <ellipse cx="80" cy="27" rx="45" ry="10" fill="#d9ac61" />
          <path d="M45 25q7-8 14-2q-6 9-14 2 M91 29q8-8 15-1q-8 9-15 1" fill="#3e8253" />
          <path d="M65 24l11-2l6 6l-12 3Z M84 31l10-2l5 5l-12 3Z" fill="#f6e3ad" />
          <ellipse cx="62" cy="32" rx="5" ry="3" fill="#ec7945" />
          <ellipse cx="104" cy="23" rx="5" ry="3" fill="#ec7945" />
          <path d="M79 20l4 1m-29 9l4 1m48 2l5-1" stroke="#f7d890" strokeWidth="1.5" strokeLinecap="round" />
        </symbol>
        <symbol id={`${id}-rice`} viewBox="0 0 100 80">
          <ellipse cx="50" cy="63" rx="43" ry="10" fill="#071914" opacity=".18" />
          <ellipse cx="50" cy="43" rx="45" ry="29" fill="#d8e7df" />
          <ellipse cx="50" cy="39" rx="45" ry="28" fill="#fff9e9" />
          <ellipse cx="50" cy="39" rx="36" ry="21" fill="#e9efdd" stroke="#bfd0c1" strokeWidth="2" />
          <path d="M20 42C18 29 29 23 40 27C50 26 56 34 51 43C43 52 29 54 20 42Z" fill="#fffdf3" />
          <path d="M25 32l5 2m5-5l4 3m-12 9l5-2m9 5l4-2" stroke="#d8d1b7" strokeWidth="2" strokeLinecap="round" />
          <path d="M57 25l15 3l6 12l-13 8l-13-8Z" fill="#965632" />
          <path d="M60 29l10 2m-12 7l12 4" stroke="#c88b54" strokeWidth="3" strokeLinecap="round" />
          <path d="M51 47C56 39 64 43 62 50C71 45 77 51 71 55C63 59 55 57 51 47Z" fill="#3e8253" />
          <circle cx="76" cy="29" r="5" fill="#e96a3d" />
        </symbol>
        <symbol id={`${id}-calamansi`} viewBox="0 0 64 64">
          <ellipse cx="33" cy="49" rx="25" ry="8" fill="#071914" opacity=".16" />
          <circle cx="31" cy="30" r="25" fill="#4e874d" />
          <circle cx="31" cy="30" r="21" fill="#f3e6ac" />
          <circle cx="31" cy="30" r="17" fill="#d1d66f" />
          <path d="M31 13v34M14 30h34M19 18l24 24M19 42l24-24" stroke="#fff4c9" strokeWidth="2" />
          <circle cx="31" cy="30" r="3" fill="#fff4c9" />
        </symbol>
        <symbol id={`${id}-chili`} viewBox="0 0 64 64">
          <path d="M17 21C37 14 55 32 39 48C30 57 17 57 7 56C32 47 36 38 17 21Z" fill="#bc4834" />
          <path d="M23 25C39 24 45 35 34 45" fill="none" stroke="#ef8b57" strokeWidth="3" strokeLinecap="round" />
          <path d="M16 23l9-7l7 8l-11 5Z" fill="#44744b" />
          <path d="M25 20q-5-8 3-14" fill="none" stroke="#366242" strokeWidth="4" strokeLinecap="round" />
        </symbol>
        <symbol id={`${id}-carrot`} viewBox="0 0 64 64">
          <path d="M19 22C12 30 25 49 43 60C41 42 37 21 29 20Z" fill="#f5b268" />
          <path d="M20 25l8 4m-3 7l8 4m0 7l5 3" stroke="#d9773d" strokeWidth="3" strokeLinecap="round" />
          <path
            d="M24 23C11 16 10 8 15 5C24 7 24 18 24 23C18 9 26 1 30 4C35 10 28 19 24 23C27 8 38 8 40 13C37 21 28 21 24 23Z"
            fill="#457b4c"
          />
        </symbol>
        <symbol id={`${id}-garlic`} viewBox="0 0 64 64">
          <ellipse cx="32" cy="53" rx="23" ry="7" fill="#071914" opacity=".16" />
          <path d="M27 8h10l-2 13C59 29 58 54 32 55C6 54 5 29 29 21Z" fill="#fff5db" />
          <path
            d="M29 22C16 31 17 47 24 53M35 22C48 31 47 47 40 53M32 24v30"
            fill="none"
            stroke="#d7c6a0"
            strokeWidth="2"
          />
          <path d="M28 9h8" stroke="#bcb18b" strokeWidth="3" />
        </symbol>
        <symbol id={`${id}-greens`} viewBox="0 0 64 64">
          <path d="M9 56C3 32 13 11 52 7C55 34 37 59 9 56Z" fill="#447c50" />
          <path
            d="M10 55L45 15M19 45l-3-13m12 1l-2-12m1 14l14 2"
            fill="none"
            stroke="#acd08b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </symbol>
        <symbol id={`${id}-soup`} viewBox="0 0 100 80">
          <ellipse cx="50" cy="69" rx="35" ry="7" fill="#071914" opacity=".18" />
          <path d="M9 34C13 62 29 72 50 72S87 62 91 34Z" fill="#e2ece4" />
          <path d="M17 45C25 59 37 63 50 63" fill="none" stroke="#fff9e9" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="50" cy="33" rx="42" ry="22" fill="#fff9e9" />
          <ellipse cx="50" cy="33" rx="34" ry="16" fill="#cc9f50" />
          <path d="M28 26l11-2l6 9l-11 5Z M56 34l11-8l9 8l-12 8Z" fill="#f5dfa0" />
          <path d="M42 23q10-11 14 1q-8 9-14-1 M29 39q-9-10 3-10q9 7-3 10 M54 42q4-12 15-6q-4 11-15 6" fill="#3e8253" />
          <circle cx="57" cy="29" r="4" fill="#e96a3d" />
          <circle cx="42" cy="39" r="3" fill="#e96a3d" />
        </symbol>
        <symbol id={`${id}-noodles`} viewBox="0 0 100 80">
          <ellipse cx="50" cy="65" rx="43" ry="8" fill="#071914" opacity=".18" />
          <ellipse cx="50" cy="42" rx="45" ry="29" fill="#d8e7df" />
          <ellipse cx="50" cy="38" rx="45" ry="27" fill="#fff9e9" />
          <ellipse cx="50" cy="38" rx="35" ry="20" fill="#a16f39" />
          <path
            d="M24 32q12-12 25 0t25 0 M22 40q12-12 27 0t27 0 M29 48q12-12 22 0t19-1"
            fill="none"
            stroke="#edc577"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path d="M33 24l8 8m22-7l-7 10m-18 6l-6 9m33-9l7 7" stroke="#4c8b59" strokeWidth="5" strokeLinecap="round" />
          <path d="M24 38l8 3m18-13l4 6m1 16l7-2" stroke="#ef8350" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="74" cy="37" rx="6" ry="4" fill="#f4eee0" />
        </symbol>
      </defs>
      <use href={`#${id}-rice`} x="-630" y="752" width="108" height="88" transform="rotate(-12 -576 796)" />
      <use href={`#${id}-soup`} x="-421" y="833" width="50" height="42" transform="rotate(10 -396 854)" />
      <use
        href={`#${id}-reference-bowl`}
        x="740"
        y="486"
        width="205"
        height="141"
        transform="rotate(-20 843 548)"
        filter={`url(#${id}-bowl-shadow)`}
      />
      <use href={`#${id}-noodles`} x="966" y="556" width="48" height="40" transform="rotate(14 990 576)" />
      <use href={`#${id}-rice`} x="872" y="628" width="68" height="56" transform="rotate(-8 906 656)" />
      <use href={`#${id}-garlic`} x="-641" y="870" width="35" height="35" transform="rotate(14 -624 887)" />
      <use href={`#${id}-carrot`} x="-595" y="916" width="46" height="46" transform="rotate(-24 -572 939)" />
      <use href={`#${id}-calamansi`} x="960" y="604" width="32" height="32" transform="rotate(-12 976 620)" />
      <use href={`#${id}-chili`} x="927" y="615" width="38" height="38" transform="rotate(28 946 634)" />
      <use href={`#${id}-greens`} x="814" y="681" width="42" height="42" transform="rotate(-18 835 702)" />
    </g>
  );
}
