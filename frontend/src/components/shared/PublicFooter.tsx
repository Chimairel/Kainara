'use client';

import React from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronUp,
  Clock,
  Mail,
  MapPin,
} from 'lucide-react';
import KainaraLogo from '@/components/shared/KainaraLogo';
import { SectionWaveBorderTop } from '@/components/landing/LandingWaveRiver';

export default function PublicFooter() {
  return (
    <div className="relative z-10">
      {/* Upper Wave Border: Signature 3-tone river stripe seamlessly transitioning into #071914 */}
      <SectionWaveBorderTop />

      {/* Dark Pine Footer Body (no bottom border) */}
      <footer className="relative bg-[#071914] text-white pt-10 sm:pt-14 overflow-hidden">
        {/* Ambient Glows */}
        <div className="pointer-events-none absolute -left-20 top-1/4 h-96 w-96 rounded-full bg-emerald-500/10 blur-[130px]" />
        <div className="pointer-events-none absolute -right-20 top-1/3 h-96 w-96 rounded-full bg-brand-cyan/10 blur-[130px]" />

        <div className="relative z-10 mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          {/* Main Navigation & Info Columns */}
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-[1.3fr_0.9fr_1fr_1fr_1.3fr] lg:gap-8 pb-12 border-b border-[#173e33]">
            {/* Column 1: Brand & Council Credential */}
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-[#0e271f] shadow-md">
                  <KainaraLogo size={32} variant="multicolor" />
                </div>
                <div>
                  <span className="font-display font-black text-2xl tracking-tight text-white block">
                    KAINARA
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-emerald-400 font-bold block">
                    Clinical Nutrition Platform
                  </span>
                </div>
              </div>

              <p className="mt-4 max-w-sm text-xs leading-6 text-white/60">
                AI-assisted Filipino meal planning, nutrition tracking and licensed nutritionist-dietitian review workflows.
              </p>

              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-[#0e271f] px-3 py-1.5 text-[11px] font-semibold text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span>PRC Accredited RND Review Network</span>
              </div>
            </div>

            {/* Column 2: Quick Links */}
            <div>
              <p className="font-display text-sm font-black uppercase tracking-[0.14em] text-white mb-4">
                Quick Links
              </p>
              <ul className="space-y-2.5 text-xs">
                {[
                  ['Home', '/'],
                  ['Platform Intelligence', '/#platform'],
                  ['How It Works', '/#process'],
                  ['For Nutritionists', '/#nutritionists'],
                  ['Evidence Sources', '/#sources'],
                  ['Documentation', '/docs'],
                ].map(([label, href]) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="group flex items-center gap-1.5 text-white/60 hover:text-emerald-400 transition-colors"
                    >
                      <ChevronRight className="h-3 w-3 text-emerald-500/60 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-400" />
                      <span>{label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Clinical & Evidence */}
            <div>
              <p className="font-display text-sm font-black uppercase tracking-[0.14em] text-white mb-4">
                Clinical Evidence
              </p>
              <ul className="space-y-2.5 text-xs">
                {[
                  ['DOST-FNRI PDRI', '/docs#data-sources'],
                  ['PhilFCT Food Data', '/docs#data-sources'],
                  ['Clinical Boundaries', '/docs#clinical-guidelines'],
                  ['Energy Calculations', '/docs#meal-planning'],
                  ['Evidence Register', '/docs#data-sources'],
                ].map(([label, href]) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="group flex items-center gap-1.5 text-white/60 hover:text-emerald-400 transition-colors"
                    >
                      <ChevronRight className="h-3 w-3 text-emerald-500/60 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-400" />
                      <span>{label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 4: Workspaces & Access */}
            <div>
              <p className="font-display text-sm font-black uppercase tracking-[0.14em] text-white mb-4">
                Workspaces
              </p>
              <ul className="space-y-2.5 text-xs">
                {[
                  ['Patient Dashboard', '/dashboard'],
                  ['RND Reviews Portal', '/nutritionist/reviews'],
                  ['Admin Control Center', '/admin/overview'],
                  ['Apply as an RND', '/nutritionist-apply'],
                  ['Track RND Application', '/nutritionist-apply#track'],
                ].map(([label, href]) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="group flex items-center gap-1.5 text-white/60 hover:text-emerald-400 transition-colors"
                    >
                      <ChevronRight className="h-3 w-3 text-emerald-500/60 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-400" />
                      <span>{label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 5: Where to reach us? */}
            <div>
              <p className="font-display text-sm font-black uppercase tracking-[0.14em] text-white mb-4">
                Where to reach us?
              </p>
              <div className="space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-[#0e271f] text-emerald-400">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-bold text-white">Clinical Operations</p>
                    <p className="text-white/60 mt-0.5">Metro Manila, Philippines</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-brand-cyan/30 bg-brand-cyan/15 text-brand-cyan">
                    <Mail className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-bold text-white">Email Inquiries</p>
                    <a
                      href="mailto:support@kainara.app"
                      className="text-white/60 hover:text-emerald-400 transition-colors mt-0.5 block"
                    >
                      support@kainara.app
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#f09e6c]/30 bg-[#f09e6c]/15 text-[#f09e6c]">
                    <Clock className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-bold text-white">Review Desk Hours</p>
                    <p className="text-white/60 mt-0.5">Mon–Fri: 8:00 AM – 5:00 PM PHT</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Copyright & Legal Row */}
          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#173e33] pt-8 pb-6 text-xs text-white/50">
            <p>© 2026 KAINARA. AI-Assisted Filipino Nutrition & Clinical Review. All rights reserved.</p>

            <div className="flex items-center gap-6 font-medium">
              <Link href="/docs" className="hover:text-emerald-400 transition-colors">
                Privacy Policy
              </Link>
              <Link href="/onboarding/tos" className="hover:text-emerald-400 transition-colors">
                Terms of Service
              </Link>
              <Link href="/docs#data-sources" className="hover:text-emerald-400 transition-colors">
                Evidence Register
              </Link>
              <Link href="/login" className="hover:text-emerald-400 transition-colors">
                Portal Login
              </Link>

              {/* Back to Top Scroll Button */}
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                aria-label="Scroll to top of page"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-accent text-white shadow-lg transition-transform hover:-translate-y-1 hover:brightness-110 active:scale-95 ml-2"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Giant Half-Shown KAINARA Display Text */}
        <div
          aria-hidden="true"
          className="pointer-events-none relative w-full overflow-hidden select-none -mb-[6.5vw] sm:-mb-[7.5vw] lg:-mb-[8.5vw] mt-2 sm:mt-4"
        >
          <div className="flex justify-center">
            <span className="font-display font-black tracking-[-0.04em] uppercase text-[17vw] sm:text-[18vw] lg:text-[19vw] leading-[0.72] text-transparent bg-gradient-to-b from-white/[0.13] via-white/[0.04] to-transparent bg-clip-text select-none block">
              KAINARA
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
