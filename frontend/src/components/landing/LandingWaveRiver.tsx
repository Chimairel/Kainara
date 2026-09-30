'use client';

import React from 'react';

/**
 * LandingWaveRiver renders a single, continuous, highly undulating 3-color wave ribbon
 * that flows with dramatic organic S-curves vertically from header to footer.
 *
 * Saturated, vibrant colors matching the "Your daily intake" card:
 * - Deep Pine Green (#1b4e41 / #12382e in dark)
 * - Terracotta Peach (#f09e6c in light and dark)
 * - Warm Coral Orange (#eb6a38 in light and dark)
 */
export default function LandingWaveRiver() {
  // Center path with pronounced, rolling wave crests and troughs (1440 x 5200 space)
  const centerD = `
    M 880 -50
    C 1080 120, 1340 220, 1360 480
    C 1380 740, 1420 950, 1430 1150
    C 1440 1350, 1320 1560, 1140 1740
    C 960 1920, 680 2050, 360 2250
    C 140 2420, 120 2680, 360 2920
    C 620 3160, 1240 3300, 1320 3580
    C 1400 3860, 1140 4060, 680 4260
    C 280 4440, 480 4760, 840 4960
    C 1060 5080, 960 5180, 780 5260
  `;

  // Left path: offset -42px
  const leftD = `
    M 838 -50
    C 1038 120, 1298 220, 1318 480
    C 1338 740, 1378 950, 1388 1150
    C 1398 1350, 1278 1560, 1098 1740
    C 918 1920, 638 2050, 318 2250
    C 98 2420, 78 2680, 318 2920
    C 578 3160, 1198 3300, 1278 3580
    C 1358 3860, 1098 4060, 638 4260
    C 238 4440, 438 4760, 798 4960
    C 1018 5080, 918 5180, 738 5260
  `;

  // Right path: offset +42px
  const rightD = `
    M 922 -50
    C 1122 120, 1382 220, 1402 480
    C 1422 740, 1462 950, 1472 1150
    C 1482 1350, 1362 1560, 1182 1740
    C 1002 1920, 722 2050, 402 2250
    C 182 2420, 162 2680, 402 2920
    C 662 3160, 1282 3300, 1362 3580
    C 1442 3860, 1182 4060, 722 4260
    C 322 4440, 522 4760, 882 4960
    C 1102 5080, 1002 5180, 822 5260
  `;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none z-0"
    >
      <svg
        viewBox="0 0 1440 5200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full opacity-100 dark:opacity-90"
        preserveAspectRatio="none"
      >
        {/* Band 1: Deep Pine Green */}
        <path
          d={leftD}
          stroke="#1b4e41"
          strokeWidth="42"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="dark:stroke-[#154236]"
        />

        {/* Band 2: Terracotta Peach (Middle) */}
        <path
          d={centerD}
          stroke="#f09e6c"
          strokeWidth="42"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="dark:stroke-[#f09e6c]"
        />

        {/* Band 3: Warm Coral Orange */}
        <path
          d={rightD}
          stroke="#eb6a38"
          strokeWidth="42"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="dark:stroke-[#eb6a38]"
        />
      </svg>
    </div>
  );
}
