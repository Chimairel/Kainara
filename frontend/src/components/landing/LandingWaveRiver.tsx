'use client';

import React from 'react';

/**
 * LandingWaveRiver renders a single, continuous, organic 3-color wave ribbon
 * that flows vertically from header to footer down the entire landing page.
 *
 * Inspired by the organic wave stripes on the "Your daily intake" card:
 * - Deep Pine Green (#1b4e41 / #154236)
 * - Terracotta Peach (#f09e6c / #e68d58)
 * - Warm Coral Orange (#eb6a38 / #ed7240)
 */
export default function LandingWaveRiver() {
  // Center path for the continuous vertical river (1440 x 5200 coordinate space)
  const centerD = `
    M 1120 -50
    C 1200 250, 1270 500, 1260 750
    C 1250 980, 1410 1200, 1410 1480
    C 1400 1740, 1060 1960, 750 2160
    C 480 2360, 340 2600, 460 2860
    C 560 3060, 1100 3260, 1260 3480
    C 1360 3680, 1430 3960, 1410 4260
    C 1390 4520, 1040 4760, 720 4920
    C 580 5040, 540 5140, 520 5260
  `;

  // Left path: offset -32px horizontally
  const leftD = `
    M 1088 -50
    C 1168 250, 1238 500, 1228 750
    C 1218 980, 1378 1200, 1378 1480
    C 1368 1740, 1028 1960, 718 2160
    C 448 2360, 308 2600, 428 2860
    C 528 3060, 1068 3260, 1228 3480
    C 1328 3680, 1398 3960, 1378 4260
    C 1358 4520, 1008 4760, 688 4920
    C 548 5040, 508 5140, 488 5260
  `;

  // Right path: offset +32px horizontally
  const rightD = `
    M 1152 -50
    C 1232 250, 1302 500, 1292 750
    C 1282 980, 1442 1200, 1442 1480
    C 1432 1740, 1092 1960, 782 2160
    C 512 2360, 372 2600, 492 2860
    C 592 3060, 1132 3260, 1292 3480
    C 1392 3680, 1462 3960, 1442 4260
    C 1422 4520, 1072 4760, 752 4920
    C 612 5040, 572 5140, 552 5260
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
        className="w-full h-full opacity-70 dark:opacity-60"
        preserveAspectRatio="none"
      >
        {/* Band 1: Deep Pine Green */}
        <path
          d={leftD}
          stroke="#1b4e41"
          strokeWidth="32"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="dark:stroke-[#154236]"
        />

        {/* Band 2: Terracotta Peach (Middle) */}
        <path
          d={centerD}
          stroke="#f09e6c"
          strokeWidth="32"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="dark:stroke-[#e68d58]"
        />

        {/* Band 3: Warm Coral Orange */}
        <path
          d={rightD}
          stroke="#eb6a38"
          strokeWidth="32"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="dark:stroke-[#ed7240]"
        />
      </svg>
    </div>
  );
}
