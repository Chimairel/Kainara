'use client';

import React from 'react';

/**
 * HERO SECTION WAVE
 * Signature left-to-right sweep across the upper hero and cockpit.
 */
export function LandingWaveHero() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-52 sm:-top-12 left-1/2 -translate-x-1/2 w-[1600px] h-[950px] max-w-none opacity-100 dark:opacity-95 select-none z-0"
    >
      <svg
        viewBox="0 0 1600 950"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Band 1: Deep Pine Green (Upper Layer) */}
        <path
          d="M 260 -40
             C 340 100, 480 200, 680 250
             C 920 310, 1160 480, 1280 640
             C 1380 770, 1500 810, 1680 840"
          stroke="#1b4e41"
          strokeWidth="48"
          strokeLinecap="round"
          className="dark:stroke-[#154236]"
        />

        {/* Band 2: Warm Terracotta Peach (Middle Layer) */}
        <path
          d="M 285 -40
             C 365 100, 505 200, 705 250
             C 945 310, 1185 480, 1305 640
             C 1405 770, 1525 810, 1705 840"
          stroke="#f09e6c"
          strokeWidth="48"
          strokeLinecap="round"
          className="dark:stroke-[#f09e6c]"
        />

        {/* Band 3: Vibrant Coral Orange (Lower Layer) */}
        <path
          d="M 310 -40
             C 390 100, 530 200, 730 250
             C 970 310, 1210 480, 1330 640
             C 1430 770, 1550 810, 1730 840"
          stroke="#eb6a38"
          strokeWidth="48"
          strokeLinecap="round"
          className="dark:stroke-[#eb6a38]"
        />
      </svg>
    </div>
  );
}

/**
 * WEAVING PROCESS WAVE (PLATFORM -> THE INTELLIGENCE LOOP)
 * - Tucks BEHIND the Platform section cards (z-20).
 * - Cascades IN FRONT OF the dark green section layer / border of #process.
 * - Sweeps BEHIND the #process text & phase cards (z-10).
 * - Exits into the bottom and tucks BEHIND the Nutritionist section card.
 */
export function LandingWaveProcess() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-32 sm:-top-40 left-1/2 -translate-x-1/2 w-[1600px] h-[750px] max-w-none opacity-100 select-none z-[5]"
    >
      <svg
        viewBox="0 0 1600 750"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Band 1: Deep Pine Green */}
        <path
          d="M -80 30
             C 260 50, 540 140, 880 120
             C 1200 100, 1440 280, 1720 360"
          stroke="#1b4e41"
          strokeWidth="48"
          strokeLinecap="round"
          className="dark:stroke-[#154236]"
        />

        {/* Band 2: Warm Terracotta Peach */}
        <path
          d="M -80 62
             C 260 82, 540 172, 880 152
             C 1200 132, 1440 312, 1720 392"
          stroke="#f09e6c"
          strokeWidth="48"
          strokeLinecap="round"
          className="dark:stroke-[#f09e6c]"
        />

        {/* Band 3: Vibrant Coral Orange */}
        <path
          d="M -80 94
             C 260 114, 540 204, 880 184
             C 1200 164, 1440 344, 1720 424"
          stroke="#eb6a38"
          strokeWidth="48"
          strokeLinecap="round"
          className="dark:stroke-[#eb6a38]"
        />
      </svg>
    </div>
  );
}

/**
 * FOOTER WAVE (CTA & FOOTER JUNCTION)
 * - Tucks BEHIND the floating orange CTA card (z-20).
 * - Sweeps IN FRONT OF the footer top border / background.
 */
export function LandingWaveFooter() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1600px] h-[500px] max-w-none opacity-100 select-none z-[5]"
    >
      <svg
        viewBox="0 0 1600 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <path
          d="M -80 280
             C 320 180, 740 360, 1120 280
             C 1340 230, 1520 160, 1680 120"
          stroke="#1b4e41"
          strokeWidth="44"
          strokeLinecap="round"
          className="dark:stroke-[#154236]"
        />
        <path
          d="M -80 312
             C 320 212, 740 392, 1120 312
             C 1340 262, 1520 192, 1680 152"
          stroke="#f09e6c"
          strokeWidth="44"
          strokeLinecap="round"
          className="dark:stroke-[#f09e6c]"
        />
        <path
          d="M -80 344
             C 320 244, 740 424, 1120 344
             C 1340 294, 1520 224, 1680 184"
          stroke="#eb6a38"
          strokeWidth="44"
          strokeLinecap="round"
          className="dark:stroke-[#eb6a38]"
        />
      </svg>
    </div>
  );
}

export default function LandingWaveRiver() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none z-0"
    >
      <LandingWaveHero />
    </div>
  );
}
