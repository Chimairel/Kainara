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
 * UPPER WAVE BORDER (REPLACES STRAIGHT TOP BORDER)
 * Replaces the plain horizontal border with the fluid 3-tone wave stripe.
 * Transitions smoothly from the light platform canvas (#faf8f5)
 * into the deep pine background (#071914) of The Intelligence Loop.
 */
export function SectionWaveBorderTop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none relative -mb-1 w-full overflow-hidden select-none z-10"
    >
      <svg
        viewBox="0 0 1440 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="w-full h-24 sm:h-32 md:h-44 block"
      >
        {/* Seamless fill below the bottom stripe to connect with #071914 */}
        <path
          d="M -20,62
             C 360,42 620,152 980,132
             C 1200,117 1340,67 1460,77
             L 1460,185 L -20,185 Z"
          fill="#071914"
        />

        {/* Band 1: Deep Pine Green (Top / Outer) */}
        <path
          d="M -20,18
             C 360,-2 620,108 980,88
             C 1200,73 1340,23 1460,33"
          stroke="#1b4e41"
          strokeWidth="24"
          strokeLinecap="round"
          className="dark:stroke-[#154236]"
          vectorEffect="non-scaling-stroke"
        />

        {/* Band 2: Warm Terracotta Peach (Middle) */}
        <path
          d="M -20,40
             C 360,20 620,130 980,110
             C 1200,95 1340,45 1460,55"
          stroke="#f09e6c"
          strokeWidth="24"
          strokeLinecap="round"
          className="dark:stroke-[#f09e6c]"
          vectorEffect="non-scaling-stroke"
        />

        {/* Band 3: Vibrant Coral Orange (Bottom / Transition into dark section) */}
        <path
          d="M -20,62
             C 360,42 620,152 980,132
             C 1200,117 1340,67 1460,77"
          stroke="#eb6a38"
          strokeWidth="24"
          strokeLinecap="round"
          className="dark:stroke-[#eb6a38]"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

/**
 * LOWER WAVE BORDER (REPLACES STRAIGHT BOTTOM BORDER)
 * Replaces the plain bottom border of The Intelligence Loop with an undulating wave stripe.
 * Transitions smoothly from deep pine (#071914) back out into the light canvas.
 */
export function SectionWaveBorderBottom() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none relative -mt-1 w-full overflow-hidden select-none z-10"
    >
      <svg
        viewBox="0 0 1440 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="w-full h-24 sm:h-32 md:h-44 block"
      >
        {/* Seamless fill from top down to the curve */}
        <path
          d="M -20,-5
             L 1460,-5
             L 1460,98
             C 1320,118 1180,48 920,38
             C 580,28 320,98 -20,58 Z"
          fill="#071914"
        />

        {/* Band 3: Vibrant Coral Orange (Top / nearest dark section) */}
        <path
          d="M -20,58
             C 320,98 580,28 920,38
             C 1180,48 1320,118 1460,98"
          stroke="#eb6a38"
          strokeWidth="24"
          strokeLinecap="round"
          className="dark:stroke-[#eb6a38]"
          vectorEffect="non-scaling-stroke"
        />

        {/* Band 2: Warm Terracotta Peach (Middle) */}
        <path
          d="M -20,80
             C 320,120 580,50 920,60
             C 1180,70 1320,140 1460,120"
          stroke="#f09e6c"
          strokeWidth="24"
          strokeLinecap="round"
          className="dark:stroke-[#f09e6c]"
          vectorEffect="non-scaling-stroke"
        />

        {/* Band 1: Deep Pine Green (Bottom / nearest light canvas) */}
        <path
          d="M -20,102
             C 320,142 580,72 920,82
             C 1180,92 1320,162 1460,142"
          stroke="#1b4e41"
          strokeWidth="24"
          strokeLinecap="round"
          className="dark:stroke-[#154236]"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

/**
 * FOOTER WAVE (CTA & FOOTER JUNCTION)
 * Sweeps behind the floating orange CTA card and across the footer boundary.
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

/**
 * DOCS WAVE HERO
 * Elegant 3-tone wave curve sweeping across the docs header.
 */
export function DocsWaveHero() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-36 sm:-top-28 right-[-5%] sm:right-[0%] w-[900px] sm:w-[1300px] h-[550px] max-w-none opacity-80 dark:opacity-60 select-none z-0"
    >
      <svg
        viewBox="0 0 1200 550"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Band 1: Deep Pine Green */}
        <path
          d="M 120 -40
             C 320 80, 520 160, 720 180
             C 960 200, 1100 360, 1260 480"
          stroke="#1b4e41"
          strokeWidth="36"
          strokeLinecap="round"
          className="dark:stroke-[#154236]"
        />

        {/* Band 2: Warm Terracotta Peach */}
        <path
          d="M 145 -40
             C 345 80, 545 160, 745 180
             C 985 200, 1125 360, 1285 480"
          stroke="#f09e6c"
          strokeWidth="36"
          strokeLinecap="round"
          className="dark:stroke-[#f09e6c]"
        />

        {/* Band 3: Vibrant Coral Orange */}
        <path
          d="M 170 -40
             C 370 80, 570 160, 770 180
             C 1010 200, 1150 360, 1310 480"
          stroke="#eb6a38"
          strokeWidth="36"
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
