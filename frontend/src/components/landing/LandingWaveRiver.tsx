'use client';

import React from 'react';

/**
 * LandingWaveRiver renders the organic 3-color flowing wave stripe
 * inspired by the "Your daily intake" card in the dashboard.
 *
 * Color palette:
 * - Deep Pine Green (#1b4e41 / #12382e in dark)
 * - Warm Coral Orange (#eb6a38)
 * - Terracotta Peach (#f09e6c)
 */
export default function LandingWaveRiver() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none z-0"
    >
      {/* HERO SECTION WAVE (TOP TO MID) */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-[1600px] h-[1100px] max-w-none opacity-90 dark:opacity-80">
        <svg
          viewBox="0 0 1600 1100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Main Flowing Ribbon: 3 Parallel Curved Bands */}
          {/* Band 1: Deep Pine Green (Upper/Outer Layer) */}
          <path
            d="M 260 -40
               C 340 100, 480 200, 680 250
               C 920 310, 1160 480, 1280 640
               C 1380 770, 1500 810, 1680 840"
            stroke="#1b4e41"
            strokeWidth="52"
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
            strokeWidth="52"
            strokeLinecap="round"
            className="dark:stroke-[#e68d58]"
          />

          {/* Band 3: Vibrant Coral Orange (Lower Layer) */}
          <path
            d="M 310 -40
               C 390 100, 530 200, 730 250
               C 970 310, 1210 480, 1330 640
               C 1430 770, 1550 810, 1730 840"
            stroke="#eb6a38"
            strokeWidth="52"
            strokeLinecap="round"
            className="dark:stroke-[#ed7240]"
          />

          {/* S-Curve Counter Ribbon across the bottom of the Hero */}
          {/* Band 1: Pine Green */}
          <path
            d="M -80 720
               C 120 740, 260 880, 520 910
               C 820 940, 1140 850, 1420 740
               C 1520 700, 1620 710, 1720 750"
            stroke="#1b4e41"
            strokeWidth="48"
            strokeLinecap="round"
            className="dark:stroke-[#154236]"
          />

          {/* Band 2: Terracotta Peach */}
          <path
            d="M -80 752
               C 120 772, 260 912, 520 942
               C 820 972, 1140 882, 1420 772
               C 1520 732, 1620 742, 1720 782"
            stroke="#f09e6c"
            strokeWidth="48"
            strokeLinecap="round"
            className="dark:stroke-[#e68d58]"
          />

          {/* Band 3: Coral Orange */}
          <path
            d="M -80 784
               C 120 804, 260 944, 520 974
               C 820 1004, 1140 914, 1420 804
               C 1520 764, 1620 774, 1720 814"
            stroke="#eb6a38"
            strokeWidth="48"
            strokeLinecap="round"
            className="dark:stroke-[#ed7240]"
          />
        </svg>
      </div>

      {/* MID-PAGE WAVE (TRANSITION INTO THE INTELLIGENCE LOOP & NUTRITIONISTS) */}
      <div className="absolute top-[1600px] left-1/2 -translate-x-1/2 w-[1600px] h-[900px] max-w-none opacity-80 dark:opacity-70">
        <svg
          viewBox="0 0 1600 900"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Sweeping undulating curves transitioning between sections */}
          <path
            d="M -60 180
               C 280 220, 560 480, 880 440
               C 1200 400, 1420 160, 1680 120"
            stroke="#1b4e41"
            strokeWidth="42"
            strokeLinecap="round"
            className="dark:stroke-[#154236]"
          />
          <path
            d="M -60 210
               C 280 250, 560 510, 880 470
               C 1200 430, 1420 190, 1680 150"
            stroke="#f09e6c"
            strokeWidth="42"
            strokeLinecap="round"
            className="dark:stroke-[#e68d58]"
          />
          <path
            d="M -60 240
               C 280 280, 560 540, 880 500
               C 1200 460, 1420 220, 1680 180"
            stroke="#eb6a38"
            strokeWidth="42"
            strokeLinecap="round"
            className="dark:stroke-[#ed7240]"
          />
        </svg>
      </div>

      {/* FOOTER SECTION WAVE (BOTTOM SWEEP) */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1600px] h-[600px] max-w-none opacity-85 dark:opacity-75">
        <svg
          viewBox="0 0 1600 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <path
            d="M -80 380
               C 320 260, 740 440, 1120 360
               C 1340 310, 1520 220, 1680 180"
            stroke="#1b4e41"
            strokeWidth="44"
            strokeLinecap="round"
            className="dark:stroke-[#154236]"
          />
          <path
            d="M -80 412
               C 320 292, 740 472, 1120 392
               C 1340 342, 1520 252, 1680 212"
            stroke="#f09e6c"
            strokeWidth="44"
            strokeLinecap="round"
            className="dark:stroke-[#e68d58]"
          />
          <path
            d="M -80 444
               C 320 324, 740 504, 1120 424
               C 1340 374, 1520 284, 1680 244"
            stroke="#eb6a38"
            strokeWidth="44"
            strokeLinecap="round"
            className="dark:stroke-[#ed7240]"
          />
        </svg>
      </div>
    </div>
  );
}
