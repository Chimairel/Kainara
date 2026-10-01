'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Database,
  Fingerprint,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Video,
  WandSparkles,
  Activity,
  Flame,
  CheckCircle2,
  Search,
} from 'lucide-react';
import PublicHeader from '@/components/shared/PublicHeader';
import PublicFooter from '@/components/shared/PublicFooter';
import KainaraLogo from '@/components/shared/KainaraLogo';
import Image from 'next/image';
import {
  LandingWaveHero,
  SectionWaveBorderTop,
  SectionWaveBorderBottom,
  SectionWaveBorderLeft,
  SectionWaveBorderRight,
} from '@/components/landing/LandingWaveRiver';
import { InfiniteSlider } from '@/components/core/infinite-slider';
import { ContainerScroll } from '@/components/ui/container-scroll-animation';
import { useAuth } from '@/hooks/useAuth';

const evidenceSliderSources = [
  {
    id: 'fnri-pdri',
    name: 'DOST-FNRI PDRI',
    sub: 'Macronutrient reference ranges',
    logo: '/sources/dost-fnri.jpg',
    href: 'https://fnri.dost.gov.ph/images/images/news/PDRI-2018.pdf',
    alt: 'DOST-FNRI PDRI logo',
  },
  {
    id: 'fnri-enutrition',
    name: 'eNutrition / PhilFCT',
    sub: 'Ingredient nutrition references',
    logo: '/sources/enutrition-logo.png',
    href: 'https://enutrition.fnri.dost.gov.ph/',
    alt: 'eNutrition PhilFCT logo',
  },
  {
    id: 'usda-fdc',
    name: 'USDA FoodData Central',
    sub: 'Food-composition fallback',
    logo: '/sources/usda.png',
    href: 'https://fdc.nal.usda.gov/download-datasets/',
    alt: 'USDA FoodData Central logo',
  },
  {
    id: 'mifflin',
    name: 'Mifflin et al. (NIH)',
    sub: 'Resting-energy estimate',
    logo: '/sources/nih.webp',
    href: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
    alt: 'NIH PubMed logo',
  },
  {
    id: 'panlasang-pinoy',
    name: 'Panlasang Pinoy',
    sub: 'Recipe provenance only',
    logo: '/sources/panlasang-pinoy.jpg',
    href: 'https://panlasangpinoy.com/',
    alt: 'Panlasang Pinoy logo',
  },
  {
    id: 'fnri-enns',
    name: 'DOST-FNRI ENNS',
    sub: 'Locality & consumption data',
    logo: '/sources/dost-fnri.jpg',
    href: 'https://enutrition.fnri.dost.gov.ph/uploads/2018-2019%20Facts%20and%20Figures%20-%20Food%20Consumption%20Survey.pdf',
    alt: 'DOST-FNRI ENNS logo',
  },
];

// Organic SVG wave masks that terminate the sources showcase track exactly at the outer wave borders
const leftTrackMaskSvg = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 300" preserveAspectRatio="none"><path d="M 22,-10 C 68,35 110,85 96,125 C 80,165 18,175 42,215 C 68,255 115,265 85,310 L 140,310 L 140,-10 Z" fill="#000"/></svg>'
)}")`;

const rightTrackMaskSvg = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 300" preserveAspectRatio="none"><path d="M 0,-10 L 138,-10 C 92,45 45,80 62,135 C 78,185 142,180 118,225 C 94,270 42,275 72,310 L 0,310 Z" fill="#000"/></svg>'
)}")`;

const getRoleHome = (role: 'USER' | 'NUTRITIONIST' | 'ADMIN') => {
  if (role === 'ADMIN') return '/admin/overview';
  if (role === 'NUTRITIONIST') return '/nutritionist/reviews';
  return '/dashboard';
};

const capabilities = [
  {
    icon: Fingerprint,
    number: '01',
    title: 'Built around your health context',
    text: 'Your goals, allergies, preferences, conditions and shopping routine shape meal selection.',
    className: 'lg:col-span-2',
    iconStyles: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    numberStyles: 'text-emerald-700/20 dark:text-emerald-400/25 group-hover:text-emerald-700/35 dark:group-hover:text-emerald-400/40',
    hoverBorder: 'hover:border-emerald-500/50',
    accentBar: 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300',
  },
  {
    icon: Database,
    number: '02',
    title: 'Filipino food intelligence',
    text: 'Browse familiar recipes, with ingredient nutrition references from FNRI and configured food-composition sources.',
    className: '',
    iconStyles: 'border-brand-accent/30 bg-brand-accent/15 text-brand-accent dark:text-[#f09e6c]',
    numberStyles: 'text-brand-accent/25 dark:text-[#f09e6c]/30 group-hover:text-brand-accent/40 dark:group-hover:text-[#f09e6c]/45',
    hoverBorder: 'hover:border-brand-accent/50',
    accentBar: 'bg-gradient-to-r from-brand-accent via-[#ed7847] to-[#f09e6c]',
  },
  {
    icon: ShieldCheck,
    number: '03',
    title: 'Review-aware by design',
    text: 'See recipe verification and meal case-review status. Restricted profiles and meals follow their applicable review requirements.',
    className: '',
    iconStyles: 'border-sky-500/30 bg-sky-500/15 text-sky-600 dark:text-cyan-400',
    numberStyles: 'text-sky-600/25 dark:text-cyan-400/30 group-hover:text-sky-600/40 dark:group-hover:text-cyan-400/45',
    hoverBorder: 'hover:border-brand-cyan/50',
    accentBar: 'bg-gradient-to-r from-brand-cyan via-teal-400 to-cyan-300',
  },
  {
    icon: Sparkles,
    number: '04',
    title: 'A library that gets smarter',
    text: 'Recorded servings and eligible case approvals can be reused when a later profile matches their reviewed scope.',
    className: 'lg:col-span-2',
    iconStyles: 'border-amber-500/35 bg-amber-500/15 text-amber-600 dark:text-[#f09e6c]',
    numberStyles: 'text-amber-600/25 dark:text-amber-400/30 group-hover:text-amber-600/40 dark:group-hover:text-amber-400/45',
    hoverBorder: 'hover:border-amber-500/50',
    accentBar: 'bg-gradient-to-r from-[#f09e6c] via-[#eb6a38] to-amber-400',
  },
];

const loopSteps = [
  {
    icon: Fingerprint,
    title: 'Profile & Clinical Intake',
    text: 'Record measurements, goals, preferences and restrictions to calculate targets and guide meal selection.',
    color: 'text-emerald-400',
    bg: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
    phaseLabel: 'text-emerald-400',
    hoverBorder: 'hover:border-emerald-500/40',
    accentDot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
  },
  {
    icon: Database,
    title: 'Recipe & Serving Matching',
    text: 'Search eligible recorded servings and published recipes before generating candidates for remaining slots.',
    color: 'text-brand-cyan',
    bg: 'border-brand-cyan/30 bg-brand-cyan/15 text-brand-cyan',
    phaseLabel: 'text-brand-cyan',
    hoverBorder: 'hover:border-brand-cyan/40',
    accentDot: 'bg-brand-cyan shadow-[0_0_8px_rgba(45,212,191,0.8)]',
  },
  {
    icon: WandSparkles,
    title: 'AI-assisted Drafts',
    text: 'Gemini can draft candidates for unfilled slots. Ingredient evidence and applicable review rules still determine their use.',
    color: 'text-[#f09e6c]',
    bg: 'border-[#f09e6c]/30 bg-[#f09e6c]/15 text-[#f09e6c]',
    phaseLabel: 'text-[#f09e6c]',
    hoverBorder: 'hover:border-[#f09e6c]/40',
    accentDot: 'bg-[#f09e6c] shadow-[0_0_8px_rgba(240,158,108,0.8)]',
  },
  {
    icon: Stethoscope,
    title: 'Professional Review',
    text: 'Nutritionists review profiles, meal cases and submitted recipes, recording decisions within each review’s scope.',
    color: 'text-brand-accent',
    bg: 'border-brand-accent/30 bg-brand-accent/15 text-brand-accent',
    phaseLabel: 'text-brand-accent',
    hoverBorder: 'hover:border-brand-accent/40',
    accentDot: 'bg-brand-accent shadow-[0_0_8px_rgba(235,106,56,0.8)]',
  },
];

const rndStages = [
  {
    icon: BadgeCheck,
    title: 'Credential Review',
    text: 'Administrators review submitted PRC license details, education and professional background.',
    color: 'text-emerald-400',
    bg: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
    stepColor: 'text-emerald-400',
    hoverBorder: 'hover:border-emerald-500/40',
  },
  {
    icon: Video,
    title: 'One-on-One Verification',
    text: 'Schedule and complete a direct online verification call with a KAINARA administrator.',
    color: 'text-brand-cyan',
    bg: 'border-brand-cyan/30 bg-brand-cyan/15 text-brand-cyan',
    stepColor: 'text-brand-cyan',
    hoverBorder: 'hover:border-brand-cyan/40',
  },
  {
    icon: ShieldCheck,
    title: 'Controlled Access',
    text: 'Approved applicants receive an account activation invitation for the nutritionist workspace.',
    color: 'text-[#f09e6c]',
    bg: 'border-[#f09e6c]/30 bg-[#f09e6c]/15 text-[#f09e6c]',
    stepColor: 'text-[#f09e6c]',
    hoverBorder: 'hover:border-[#f09e6c]/40',
  },
];

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user?.emailVerified) {
      const destination =
        user.role === 'ADMIN'
          ? '/admin/overview'
          : user.role === 'NUTRITIONIST'
            ? '/nutritionist/reviews'
            : !user.onboardingDone
              ? user.onboardingNextPath || '/onboarding/stats'
              : !user.tosAccepted
                ? '/onboarding/tos'
                : '/dashboard';
      router.replace(destination);
    }
  }, [user, isLoading, router]);

  const isPendingVerification = Boolean(user && !user.emailVerified);
  const workspaceHref = user ? (isPendingVerification ? '/verify-email' : getRoleHome(user.role)) : '/register';
  const workspaceLabel = user
    ? isPendingVerification
      ? 'Continue email verification'
      : user.role === 'USER'
        ? 'Go to Dashboard'
        : 'Open Portal'
    : 'Build my profile';

  // Pending verification can browse the public home page. Its call to action
  // still leads back to verification; protected routes remain gated.
  if (user?.emailVerified) {
    return null;
  }

  return (
    <div className="relative min-h-screen bg-brand-bg text-brand-text selection:bg-brand-accent selection:text-white">
      <PublicHeader />

      <main className="overflow-x-clip">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-6 pb-16 md:pt-10 md:pb-24">
          <LandingWaveHero />
          {/* Ambient glow mesh background */}
          <div className="pointer-events-none absolute left-[5%] top-16 h-96 w-96 rounded-full bg-emerald-500/15 blur-[120px] dark:bg-emerald-500/10" />
          <div className="pointer-events-none absolute right-[5%] top-24 h-[420px] w-[420px] rounded-full bg-brand-cyan/15 blur-[140px] dark:bg-brand-cyan/10" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[600px] rounded-full bg-brand-accent/10 blur-[160px] dark:bg-brand-accent/5" />

          <ContainerScroll
            layout="side-by-side"
            badgeLeft={
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -left-4 sm:-left-6 top-12 z-30 hidden w-48 rounded-2xl border border-emerald-500/30 bg-[#071914]/95 p-4 text-white shadow-2xl backdrop-blur-xl sm:block"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    <HeartPulse className="h-3.5 w-3.5" />
                    Target Calorie
                  </div>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-black text-white">2,150</span>
                  <span className="text-[11px] font-semibold text-emerald-300/70">kcal / day</span>
                </div>
                {/* Segmented Macro Bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-[9px] font-mono text-white/50 mb-1">
                    <span>C 50%</span>
                    <span>P 25%</span>
                    <span>F 25%</span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-white/10 gap-0.5">
                    <div className="h-full w-1/2 bg-gradient-to-r from-emerald-400 to-teal-400" />
                    <div className="h-full w-1/4 bg-brand-accent" />
                    <div className="h-full w-1/4 bg-brand-cyan" />
                  </div>
                </div>
              </motion.div>
            }
            badgeRight={
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -bottom-6 -right-3 sm:-right-6 z-30 hidden w-56 rounded-2xl border border-brand-cyan/30 bg-brand-surface/95 p-4 shadow-xl backdrop-blur-xl sm:block"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-cyan/15 text-brand-cyan">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-brand-text">Meal review status</p>
                    <p className="text-[10px] text-brand-muted">Recorded decisions and scope</p>
                  </div>
                </div>
              </motion.div>
            }
            cardClassName="border-[#6C6C6C] bg-[#222222]"
            innerClassName="p-0 bg-[#071914] border border-[#173e33]/80"
            titleComponent={
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 max-w-2xl text-left"
              >
                <h1 className="font-display text-[clamp(2.75rem,5.5vw,7.2rem)] font-black leading-[0.92] tracking-[-0.06em] text-brand-text">
                  Eat with
                  <span className="text-gradient block pb-2">intention.</span>
                </h1>

                <p className="mt-5 max-w-xl text-base leading-7 text-brand-muted sm:text-lg sm:leading-8">
                  KAINARA brings familiar recipes, calculated nutrition targets and daily tracking into one workspace,
                  with AI-assisted planning and nutritionist review for applicable cases.
                </p>

                <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:items-center">
                  <Link
                    href={workspaceHref}
                    className="group flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-brand-accent px-7 text-sm font-extrabold text-white shadow-neon transition duration-200 hover:-translate-y-1 hover:brightness-110 active:scale-[0.98]"
                  >
                    {workspaceLabel}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link
                    href="/docs"
                    className="group flex min-h-14 items-center justify-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-[#071914] px-7 text-sm font-bold text-white shadow-md transition duration-200 hover:-translate-y-1 hover:border-emerald-400/50 hover:bg-[#0e271f] hover:shadow-lg active:scale-[0.98]"
                  >
                    Documentation
                    <ArrowUpRight className="h-4 w-4 text-emerald-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </div>

                {/* Trust Indicators */}
                <div className="mt-10 grid max-w-xl grid-cols-3 gap-4 border-t border-brand-border/70 pt-6">
                  {[
                    ['7 Days', 'Personalized Cycle', Flame, 'text-brand-accent dark:text-[#f09e6c]'],
                    ['3 Roles', 'Patient, RND & Admin', Activity, 'text-sky-600 dark:text-cyan-400'],
                    ['Visible', 'Meal Review Status', CheckCircle2, 'text-emerald-600 dark:text-emerald-400'],
                  ].map(([value, label, Icon, colorClass]) => {
                    const StatIcon = Icon as React.ComponentType<{ className?: string }>;
                    return (
                      <div key={label as string} className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <StatIcon className={`h-4 w-4 ${colorClass as string}`} />
                          <p className="font-display text-lg font-black tracking-tight text-brand-text sm:text-xl">
                            {value as string}
                          </p>
                        </div>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-muted">
                          {label as string}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            }
          >
            {/* Main Cockpit Inside Container Card */}
            <div className="flex h-full w-full flex-col overflow-hidden bg-[#071914]">
              {/* Browser Chrome Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-[#173e33] bg-[#0a1b16] px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]/90 shadow-sm" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]/90 shadow-sm" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]/90 shadow-sm" />
                  <span className="ml-2 font-mono text-[10px] text-white/50 hidden xs:inline">
                    kainara.vercel.app/dashboard
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-[#0e271f] px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
                  <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400 font-bold">
                    Live Cockpit • Manila, PH
                  </span>
                </div>
              </div>

              {/* Dashboard Screenshot Mockup */}
              <div className="relative overflow-hidden bg-[#071914]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/dashboard-actual.png"
                  alt="KAINARA Clinical Nutrition Cockpit"
                  className="w-full h-auto object-cover object-top transition duration-700 hover:scale-[1.01]"
                  loading="eager"
                />
              </div>
            </div>
          </ContainerScroll>
        </section>

        {/* PLATFORM INTELLIGENCE BENTO GRID */}
        <section id="platform" className="relative z-20 mx-auto max-w-[1440px] scroll-mt-24 px-5 py-20 sm:px-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6 }}
            className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end"
          >
            <div>
              <h2 className="max-w-lg font-display text-3xl font-black leading-[1.05] tracking-[-0.04em] text-brand-text sm:text-5xl">
                Personal enough to matter. Structured enough to trust.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-brand-muted lg:ml-auto lg:text-base">
              KAINARA unites the patient everyday routine with licensed nutritionist oversight and administrative review
              workflows. Recipe identity, nutrition estimates and case decisions have distinct roles in planning.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {capabilities.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.article
                  key={item.number}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                  className={`surface-panel group relative min-h-[260px] overflow-hidden rounded-[28px] p-7 transition duration-300 ${item.hoverBorder} ${item.className}`}
                >
                  <div
                    className={`absolute right-6 top-3 font-display text-8xl font-black tracking-tighter select-none transition-colors duration-300 ${item.numberStyles}`}
                  >
                    {item.number}
                  </div>
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-transform duration-300 group-hover:scale-110 ${item.iconStyles}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-8 max-w-md font-display text-xl font-extrabold tracking-tight text-brand-text">
                    {item.title}
                  </h3>
                  <p className="mt-2.5 max-w-xl text-sm leading-6 text-brand-muted">{item.text}</p>
                  <div
                    className={`absolute bottom-0 left-0 h-1 w-0 transition-all duration-500 group-hover:w-full ${item.accentBar}`}
                  />
                </motion.article>
              );
            })}
          </div>
        </section>

        {/* THE INTELLIGENCE LOOP (FOREST PINE CONTINENT WITH ORGANIC WAVE BORDERS) */}
        <div id="process" className="relative z-10 scroll-mt-20">
          {/* Upper Wave Border: Replaces straight horizontal border */}
          <SectionWaveBorderTop />

          {/* Dark Pine Section Body */}
          <section className="relative bg-[#071914] py-14 sm:py-20 text-white">
            <div className="pointer-events-none absolute -left-20 top-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-emerald-500/10 blur-[120px]" />
            <div className="pointer-events-none absolute -right-20 top-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-brand-cyan/10 blur-[120px]" />

            <div className="relative z-10 mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.6 }}
                className="mx-auto max-w-2xl text-center"
              >
                <h2 className="font-display text-3xl font-black tracking-[-0.04em] sm:text-5xl">
                  From your profile to a meal plan.
                </h2>
                <p className="mt-4 text-sm sm:text-base text-white/60">
                  Profile context, recorded recipes, AI assistance and applicable review requirements guide meal
                  selection.
                </p>
              </motion.div>

              <div className="mt-16 grid gap-px overflow-hidden rounded-[28px] border border-[#173e33] bg-[#173e33]/60 md:grid-cols-4">
                {loopSteps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <motion.article
                      key={step.title}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-50px' }}
                      transition={{ duration: 0.5, delay: index * 0.12 }}
                      className="group relative bg-[#091b15] p-7 md:min-h-[300px] hover:bg-[#0c241d] transition duration-300"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.2em] ${step.phaseLabel}`}>
                          Phase 0{index + 1}
                        </span>
                        <span className={`h-2 w-2 rounded-full ${step.accentDot}`} />
                      </div>
                      <div
                        className={`mt-7 flex h-12 w-12 items-center justify-center rounded-2xl border transition-transform duration-300 group-hover:scale-110 ${step.bg}`}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="mt-6 font-display text-lg font-bold text-white">{step.title}</h3>
                      <p className="mt-2.5 text-xs leading-5 text-white/55">{step.text}</p>
                      {index < 3 && (
                        <ArrowRight className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 hidden h-5 w-5 text-white/30 md:block transition-colors group-hover:text-white/70" />
                      )}
                    </motion.article>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Lower Wave Border: Replaces straight bottom border */}
          <SectionWaveBorderBottom />
        </div>

        {/* NUTRITIONIST RND RECRUITMENT */}
        <section id="nutritionists" className="relative z-20 mx-auto max-w-[1440px] scroll-mt-24 px-5 py-24 sm:px-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7 }}
            className="relative overflow-hidden rounded-[36px] bg-[#071914] p-8 text-white shadow-2xl sm:p-12 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:p-16 border border-[#173e33]"
          >
            {/* Retro Wave Organic Corner Accent (Hint of stripe inside card) */}
            <div className="pointer-events-none absolute -top-0.5 -right-0.5 h-48 w-48 sm:h-64 sm:w-64 overflow-hidden rounded-tr-[36px] z-0 opacity-85">
              <svg viewBox="0 0 160 160" className="h-full w-full" fill="none">
                <path d="M160,0 L0,0 C20,40 55,95 120,135 C140,147 160,155 160,155 Z" fill="#eb6a38" />
                <path d="M160,0 L40,0 C55,30 80,72 130,105 C145,115 160,120 160,120 Z" fill="#f09e6c" />
                <path d="M160,0 L82,0 C92,20 110,48 142,70 C152,76 160,80 160,80 Z" className="fill-[#1b4e41]" />
              </svg>
            </div>

            <div className="pointer-events-none absolute left-0 bottom-0 h-80 w-80 rounded-full bg-brand-cyan/10 blur-[120px]" />

            {/* Subtle Watermarked Logo Seal */}
            <div className="pointer-events-none absolute -bottom-6 -right-6 hidden lg:flex items-center justify-center opacity-25">
              <div className="flex h-36 w-36 items-center justify-center rounded-full bg-[#0a201a] border border-[#173e33]/80">
                <KainaraLogo size={90} variant="multicolor" />
              </div>
            </div>

            <div className="relative z-10">
              <h2 className="max-w-2xl font-display text-3xl font-black leading-[1.05] tracking-[-0.04em] sm:text-5xl">
                Review recipes and meal suitability.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-white/60 sm:text-base">
                Apply online from anywhere in the Philippines to join KAINARA&apos;s accredited RND review council.
                Every application undergoes license credential screening and direct verification before audit access is
                granted.
              </p>
              <div className="mt-8 flex flex-col gap-3.5 sm:flex-row">
                <Link
                  href="/nutritionist-apply"
                  className="inline-flex min-h-[52px] items-center justify-center gap-3 rounded-2xl bg-brand-accent px-7 text-sm font-extrabold text-white shadow-lg transition duration-200 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]"
                >
                  Apply as an RND <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/nutritionist-apply#track"
                  className="group inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-2xl border border-emerald-500/35 bg-emerald-500/15 px-6 text-sm font-bold text-white shadow-md transition duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-500/25 active:scale-[0.98]"
                >
                  <Search className="h-4 w-4 text-emerald-400 transition-transform group-hover:scale-110" />
                  Track Application Status
                  <ArrowRight className="h-4 w-4 text-emerald-400/70 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-400" />
                </Link>
              </div>
            </div>

            <div className="relative z-10 mt-10 grid gap-3.5 lg:mt-0">
              {rndStages.map(({ icon: Icon, title, text, bg, stepColor, hoverBorder }, index) => (
                <div
                  key={title}
                  className={`group flex gap-4 rounded-[22px] border border-[#173e33] bg-[#0e271f]/80 p-5 backdrop-blur-xl transition hover:bg-[#0e271f] ${hoverBorder}`}
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-transform duration-300 group-hover:scale-105 ${bg}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className={`font-mono text-[9px] uppercase tracking-[0.16em] font-bold ${stepColor}`}>
                      Step 0{index + 1}
                    </p>
                    <h3 className="mt-1 text-sm font-bold text-white">{title}</h3>
                    <p className="mt-1.5 text-xs leading-5 text-white/50">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* EVIDENCE AND SOURCES */}
        <section id="sources" className="border-y border-brand-border/60 bg-brand-surface/30 py-24">
          <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.6 }}
              className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end"
            >
              <div>
                <h2 className="max-w-xl font-display text-3xl font-black leading-[1.05] tracking-[-0.04em] text-brand-text sm:text-5xl">
                  Food data, calculation methods and recipe sources.
                </h2>
              </div>
              <div className="max-w-2xl lg:ml-auto">
                <p className="text-sm leading-7 text-brand-muted sm:text-base">
                  Food-composition records support ingredient matching, published methods support energy estimates, and
                  recipe links identify the original dish. Available data varies by ingredient and configured source; a
                  source citation does not approve a meal for a health condition.
                </p>
                <Link
                  href="/docs#data-sources"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Read the complete evidence register <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>

            {/* Dark Pine Showcase Track Bounded Organically by Wave Stripes */}
            <div className="relative mt-14">
              {/* Left and Right Vertical Wave Borders (z-20) forming the organic left and right ends of the card */}
              <SectionWaveBorderLeft />
              <SectionWaveBorderRight />

              {/* Masked Card Track Body - Terminated precisely at the wave stripes */}
              <div
                className="relative overflow-hidden border-y border-[#173e33] bg-[#071914] py-8 sm:py-12"
                style={{
                  maskImage: `${leftTrackMaskSvg}, linear-gradient(#000, #000), ${rightTrackMaskSvg}`,
                  WebkitMaskImage: `${leftTrackMaskSvg}, linear-gradient(#000, #000), ${rightTrackMaskSvg}`,
                  maskPosition: 'left top, 140px top, right top',
                  WebkitMaskPosition: 'left top, 140px top, right top',
                  maskSize: '140px 100%, calc(100% - 300px) 100%, 160px 100%',
                  WebkitMaskSize: '140px 100%, calc(100% - 300px) 100%, 160px 100%',
                  maskRepeat: 'no-repeat',
                  WebkitMaskRepeat: 'no-repeat',
                }}
              >
                {/* Ambient Glows */}
                <div className="pointer-events-none absolute left-1/4 top-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-emerald-500/10 blur-[100px]" />
                <div className="pointer-events-none absolute right-1/4 top-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-brand-cyan/10 blur-[100px]" />

                {/* Infinite Looping Slider for Evidence & Recipe Sources */}
                <div className="relative py-3">
                  <InfiniteSlider gap={32} speed={42} speedOnHover={14} reverse>
                    {[...evidenceSliderSources, ...evidenceSliderSources].map((source, index) => (
                      <a
                        key={`${source.id}-${index}`}
                        href={source.href}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex h-[136px] items-center gap-6 rounded-[28px] border border-[#173e33] bg-[#0e271f]/95 px-7 py-4 shadow-[0_16px_36px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-500/50 hover:bg-[#0c241d] hover:shadow-[0_24px_50px_rgba(0,0,0,0.6)]"
                        aria-label={`Open citation for ${source.name}`}
                      >
                        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-white p-2.5 overflow-hidden transition-transform duration-300 group-hover:scale-105">
                          <Image
                            src={source.logo}
                            alt={source.alt}
                            width={96}
                            height={96}
                            unoptimized
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <div className="flex flex-col pr-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base sm:text-lg font-black tracking-tight text-white group-hover:text-emerald-400 transition-colors whitespace-nowrap">
                              {source.name}
                            </span>
                            <ArrowUpRight className="h-4 w-4 text-emerald-400/60 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-emerald-400 transition-all" />
                          </div>
                          <span className="mt-1 font-mono text-[11px] font-bold uppercase tracking-wider text-white/50 whitespace-nowrap">
                            {source.sub}
                          </span>
                        </div>
                      </a>
                    ))}
                  </InfiniteSlider>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DOCUMENTATION & GUIDES */}
        <section className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7 }}
            className="grid overflow-hidden rounded-[36px] border border-brand-border/70 bg-brand-surface/80 shadow-2xl backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]"
          >
            {/* Left Column: Documentation Overview */}
            <div className="flex flex-col justify-between p-8 sm:p-12 lg:p-14 xl:p-16">
              <div>
                <h2 className="max-w-xl font-display text-3xl font-black leading-[1.05] tracking-[-0.04em] sm:text-5xl">
                  The comprehensive guide to <span className="text-gradient">KAINARA.</span>
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-brand-muted sm:text-base">
                  Explore meal planning, energy estimates, food-composition references, nutritionist review, account
                  controls and help for using KAINARA.
                </p>

                {/* Guide Pillar Tags */}
                <div className="mt-8 flex flex-wrap gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border/80 bg-brand-bg/60 px-3 py-1.5 text-xs font-semibold text-brand-text">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Clinical Safeguards
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border/80 bg-brand-bg/60 px-3 py-1.5 text-xs font-semibold text-brand-text">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-cyan" />
                    FNRI / USDA References
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border/80 bg-brand-bg/60 px-3 py-1.5 text-xs font-semibold text-brand-text">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#f09e6c]" />
                    Workflow Handbooks
                  </span>
                </div>
              </div>

              <div className="mt-10">
                <Link
                  href="/docs"
                  className="group inline-flex min-h-12 items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-[#071914] px-7 text-sm font-bold text-white shadow-md transition duration-200 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:bg-[#0e271f] hover:shadow-lg active:scale-[0.98]"
                >
                  Explore Documentation
                  <ArrowUpRight className="h-4 w-4 text-emerald-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>
            </div>

            {/* Right Column: Interactive Guides Cockpit */}
            <div className="relative min-h-[460px] overflow-hidden bg-[#071914] p-7 text-white sm:p-10 border-t lg:border-t-0 lg:border-l border-[#173e33]">
              {/* Ambient Glows */}
              <div className="pointer-events-none absolute right-4 top-4 h-48 w-48 rounded-full bg-brand-cyan/15 blur-3xl" />
              <div className="pointer-events-none absolute left-4 bottom-4 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />

              {/* Watermark Logo */}
              <div className="pointer-events-none absolute -bottom-8 -right-8 hidden sm:flex items-center justify-center opacity-10">
                <KainaraLogo size={160} variant="multicolor" />
              </div>

              <div className="relative z-10 grid h-full grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Restrictions & Review - Left Tall Card */}
                <Link
                  href="/docs#clinical-guidelines"
                  className="group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-[#173e33] bg-[#091b15]/90 p-6 transition duration-200 hover:border-emerald-500/50 hover:bg-[#0c241d] hover:shadow-[0_8px_30px_rgba(16,185,129,0.12)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-400/90">
                      Clinical Scope
                    </span>
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:border-emerald-400/40">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </div>
                  </div>

                  <div className="my-auto py-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-transform duration-300 group-hover:scale-105">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 font-display text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                      Restrictions & Review
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-white/60">
                      Declared restrictions, profile checks and scoped nutritionist decisions.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 border-t border-[#173e33]/70 pt-3">
                    <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] text-emerald-300">
                      Allergies
                    </span>
                    <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] text-emerald-300">
                      Conditions
                    </span>
                    <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] text-emerald-300">
                      RND Audit
                    </span>
                  </div>
                </Link>

                {/* Right Stacked Cards */}
                <div className="grid gap-4">
                  {/* Energy & Food References */}
                  <Link
                    href="/docs#meal-planning"
                    className="group relative flex flex-col justify-between rounded-[24px] border border-[#173e33] bg-[#091b15]/90 p-5 transition duration-200 hover:border-brand-cyan/50 hover:bg-[#0c241d] hover:shadow-[0_8px_30px_rgba(6,182,212,0.12)]"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-cyan/30 bg-brand-cyan/15 text-brand-cyan transition-transform duration-300 group-hover:scale-105">
                          <Database className="h-5 w-5" />
                        </div>
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:border-brand-cyan/40">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </div>
                      </div>
                      <h3 className="mt-3.5 text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                        Energy & Food References
                      </h3>
                      <p className="mt-1 text-[11px] leading-4 text-white/60">
                        Resting-energy estimates, activity adjustments and ingredient nutrition.
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#173e33]/70 pt-2.5">
                      <span className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-300">
                        FNRI FCT
                      </span>
                      <span className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-300">
                        Mifflin-St Jeor
                      </span>
                    </div>
                  </Link>

                  {/* User Guides & FAQs */}
                  <Link
                    href="/docs#help"
                    className="group relative flex flex-col justify-between rounded-[24px] border border-[#173e33] bg-[#091b15]/90 p-5 transition duration-200 hover:border-[#f09e6c]/50 hover:bg-[#0c241d] hover:shadow-[0_8px_30px_rgba(240,158,108,0.12)]"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#f09e6c]/30 bg-[#f09e6c]/15 text-[#f09e6c] transition-transform duration-300 group-hover:scale-105">
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#f09e6c]/20 bg-[#f09e6c]/10 text-[#f09e6c] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:border-[#f09e6c]/40">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </div>
                      </div>
                      <h3 className="mt-3.5 text-sm font-bold text-white group-hover:text-[#f09e6c] transition-colors">
                        User Guides & FAQs
                      </h3>
                      <p className="mt-1 text-[11px] leading-4 text-white/60">
                        Starter bridge plans, meal swaps, and grocery lists.
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#173e33]/70 pt-2.5">
                      <span className="rounded-md border border-[#f09e6c]/20 bg-[#f09e6c]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#f09e6c]">
                        Bridge Plans
                      </span>
                      <span className="rounded-md border border-[#f09e6c]/20 bg-[#f09e6c]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#f09e6c]">
                        Meal Swaps
                      </span>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* BOTTOM CALL TO ACTION */}
        <section className="relative z-20 px-5 pb-24 sm:px-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 30 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7 }}
            className="relative mx-auto max-w-[1344px] overflow-hidden rounded-[36px] bg-gradient-to-r from-brand-accent via-[#ed7847] to-[#eb6a38] px-7 py-14 text-white shadow-2xl sm:px-12 lg:flex lg:items-center lg:justify-between lg:px-16"
          >
            <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full border-[50px] border-white/10" />
            <div className="pointer-events-none absolute left-1/3 -bottom-16 h-60 w-60 rounded-full bg-white/5 blur-2xl" />
            <div className="relative">
              <h2 className="max-w-2xl font-display text-3xl font-black tracking-[-0.04em] sm:text-4xl text-white">
                A smarter weekly plan starts with understanding you.
              </h2>
              <p className="mt-2 text-sm text-white/80 max-w-xl">
                Join KAINARA today for personalized Filipino meal planning supervised by registered nutritionists.
              </p>
            </div>
            <Link
              href={workspaceHref}
              className="relative mt-8 inline-flex min-h-[54px] items-center gap-3 rounded-2xl bg-[#071914] px-8 text-sm font-black text-white shadow-xl transition hover:-translate-y-1 hover:brightness-110 active:scale-[0.98] lg:mt-0"
            >
              Start Onboarding
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
