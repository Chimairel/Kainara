'use client';

import React from 'react';

/**
 * LandingWaveRiver renders the organic 3-color flowing wave stripe
 * with the signature left-to-right sweep across the hero and section transitions,
 * kept clean, balanced, and perfectly weighted without overloading the hero.
 *
 * Color palette matching the "Your daily intake" card:
 * - Deep Pine Green (#1b4e41 / #154236 in dark)
 * - Terracotta Peach (#f09e6c)
 * - Warm Coral Orange (#eb6a38)
 */
export default function LandingWaveRiver() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none z-0"
    >
      {/* HERO SECTION WAVE (SIGNATURE LEFT-TO-RIGHT SWEEP BEHIND COCKPIT) */}
      <div className="absolute -top-52 sm:-top-12 left-1/2 -translate-x-1/2 w-[1600px] h-[950px] max-w-none opacity-100 dark:opacity-95">
        <svg
          viewBox="0 0 1600 950"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Main Flowing Ribbon: 3 Parallel Curved Bands */}
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

      {/* MID-PAGE WAVE (TRANSITION INTO THE INTELLIGENCE LOOP) */}
      <div className="absolute top-[1650px] left-1/2 -translate-x-1/2 w-[1600px] h-[850px] max-w-none opacity-95 dark:opacity-90">
        <svg
          viewBox="0 0 1600 850"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <path
            d="M -60 220
               C 280 260, 560 520, 880 480
               C 1200 440, 1420 200, 1680 160"
            stroke="#1b4e41"
            strokeWidth="42"
            strokeLinecap="round"
            className="dark:stroke-[#154236]"
          />
          <path
            d="M -60 250
               C 280 290, 560 550, 880 510
               C 1200 470, 1420 230, 1680 190"
            stroke="#f09e6c"
            strokeWidth="42"
            strokeLinecap="round"
            className="dark:stroke-[#f09e6c]"
          />
          <path
            d="M -60 280
               C 280 320, 560 580, 880 540
               C 1200 500, 1420 260, 1680 220"
            stroke="#eb6a38"
            strokeWidth="42"
            strokeLinecap="round"
            className="dark:stroke-[#eb6a38]"
          />
        </svg>
      </div>

      {/* FOOTER SECTION WAVE (BOTTOM SWEEP BEHIND CTA) */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1600px] h-[600px] max-w-none opacity-100 dark:opacity-90">
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
            className="dark:stroke-[#f09e6c]"
          />
          <path
            d="M -80 444
               C 320 324, 740 504, 1120 424
               C 1340 374, 1520 284, 1680 244"
            stroke="#eb6a38"
            strokeWidth="44"
            strokeLinecap="round"
            className="dark:stroke-[#eb6a38]"
          />
        </svg>
      </div>
    </div>
  );
}
