'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenText,
  BadgeCheck,
  CircleDot,
  Database,
  Fingerprint,
  HeartPulse,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Video,
  WandSparkles,
  Activity,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import PublicHeader from '@/components/shared/PublicHeader';
import KainaraLogo from '@/components/shared/KainaraLogo';
import { useAuth } from '@/hooks/useAuth';
import { EVIDENCE_SOURCES, EVIDENCE_STATUS_LABELS } from '@/data/evidence-sources';

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
    text: 'Goals, allergies, preferences, conditions, and shopping routines shape every planning decision—not just a calorie number.',
    className: 'lg:col-span-2',
    accent: 'from-emerald-500/20 to-brand-green/5',
  },
  {
    icon: Database,
    number: '02',
    title: 'Filipino food intelligence',
    text: 'Meals are grounded in familiar ingredients and official Philippine Food Composition Tables (FNRI).',
    className: '',
    accent: 'from-brand-cyan/20 to-sky-500/5',
  },
  {
    icon: ShieldCheck,
    number: '03',
    title: 'Review-aware by design',
    text: 'AI-created meals remain clearly pending until a nutritionist reviews them. Verification is visible, never implied.',
    className: '',
    accent: 'from-amber-500/20 to-brand-accent/5',
  },
  {
    icon: Sparkles,
    number: '04',
    title: 'A library that gets smarter',
    text: 'Verified meals are reusable for compatible health profiles, reducing AI hallucination while growing a clinical database.',
    className: 'lg:col-span-2',
    accent: 'from-teal-500/20 to-emerald-500/5',
  },
];

const loopSteps = [
  {
    icon: Fingerprint,
    title: 'Profile & Clinical Intake',
    text: 'Capture health goals, dietary needs, allergies, and lifestyle context with Mifflin-St Jeor precision.',
  },
  {
    icon: Database,
    title: 'FNRI & Library Matching',
    text: 'Search compatible verified meals from licensed nutritionists before generating anything new.',
  },
  {
    icon: WandSparkles,
    title: 'AI Gap Synthesis',
    text: 'Use Gemini AI only for plan gaps, with pending clinical status prominently displayed to the user.',
  },
  {
    icon: Stethoscope,
    title: 'Nutritionist Audit',
    text: 'Route generated meals to registered nutritionist-dietitians to approve, adjust, and expand the library.',
  },
];

const rndStages = [
  {
    icon: BadgeCheck,
    title: 'Credential Review',
    text: 'PRC license details, university credentials, and clinical background are rigorously assessed.',
  },
  {
    icon: Video,
    title: 'One-on-One Verification',
    text: 'Schedule and complete a direct online verification call with a KAINARA administrator.',
  },
  {
    icon: ShieldCheck,
    title: 'Controlled Access',
    text: 'Only verified RNDs receive a private, cryptographic audit account invitation.',
  },
];

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      const destination = !user.emailVerified
        ? '/verify-email'
        : user.role === 'ADMIN'
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
    : 'Build my nutrition profile';

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen text-brand-text selection:bg-brand-accent selection:text-white">
      <PublicHeader />

      <main className="overflow-x-clip">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-6 pb-16 md:pt-10 md:pb-24">
          {/* Ambient glow mesh background */}
          <div className="pointer-events-none absolute left-[5%] top-16 h-96 w-96 rounded-full bg-emerald-500/15 blur-[120px] dark:bg-emerald-500/10" />
          <div className="pointer-events-none absolute right-[5%] top-24 h-[420px] w-[420px] rounded-full bg-brand-cyan/15 blur-[140px] dark:bg-brand-cyan/10" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[600px] rounded-full bg-brand-accent/10 blur-[160px] dark:bg-brand-accent/5" />

          <div className="mx-auto grid min-h-[calc(100vh-120px)] max-w-[1440px] items-center gap-12 px-5 sm:px-8 md:grid-cols-[0.92fr_1.08fr] lg:gap-16 lg:px-12">
            {/* Left Column: Headline & Action */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 max-w-2xl"
            >
              <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-400 backdrop-blur-md mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="tracking-wide">AI-Assisted Filipino Nutrition & Clinical Oversight</span>
              </div>

              <h1 className="font-display text-[clamp(2.75rem,5.5vw,7.2rem)] font-black leading-[0.92] tracking-[-0.06em] text-brand-text">
                Eat with
                <span className="text-gradient block pb-2">intention.</span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-brand-muted sm:text-lg sm:leading-8">
                KAINARA transforms personal biometric and clinical context into culturally authentic Filipino meal plans,
                coupling Gemini AI with FNRI food tables and licensed nutritionist review.
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
                  className="group flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-brand-border/80 bg-brand-surface/70 px-6 text-sm font-bold text-brand-text backdrop-blur-xl transition duration-200 hover:-translate-y-1 hover:border-brand-green/40 hover:bg-brand-surface"
                >
                  <BookOpenText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Explore Documentation
                  <ArrowUpRight className="h-3.5 w-3.5 text-brand-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="mt-10 grid max-w-xl grid-cols-3 gap-4 border-t border-brand-border/70 pt-6">
                {[
                  ['7 Days', 'Personalized Cycle', Flame],
                  ['3 Roles', 'Patient, RND & Admin', Activity],
                  ['100%', 'Transparent Verification', CheckCircle2],
                ].map(([value, label, Icon]) => {
                  const StatIcon = Icon as React.ComponentType<{ className?: string }>;
                  return (
                    <div key={label as string} className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <StatIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
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

            {/* Right Column: Dynamic Interactive Hero Mockup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="relative mx-auto w-full max-w-[720px] md:ml-auto"
            >
              {/* Floating Health Sync Card (Dashboard Theme) */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -left-6 top-16 z-30 hidden w-48 rounded-2xl border border-emerald-500/30 bg-[#071914]/95 p-4 text-white shadow-2xl backdrop-blur-xl sm:block"
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

              {/* Main Cockpit Frame */}
              <div className="surface-panel futuristic-grid relative overflow-hidden rounded-[32px] p-2 sm:p-3.5 shadow-2xl border border-brand-border/80">
                <div className="scan-line" />
                <div className="overflow-hidden rounded-[24px] border border-[#173e33] bg-[#071914] text-white shadow-2xl">
                  {/* Browser Chrome Header */}
                  <div className="flex items-center justify-between border-b border-[#173e33] bg-[#0a1b16] px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]/90 shadow-sm" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]/90 shadow-sm" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]/90 shadow-sm" />
                      <span className="ml-2 font-mono text-[10px] text-white/50 hidden xs:inline">
                        app.kainara.ph/dashboard
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
              </div>

              {/* Floating Verified Badge (Bottom Right) */}
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -bottom-6 -right-3 z-30 hidden w-56 rounded-2xl border border-brand-cyan/30 bg-brand-surface/95 p-4 shadow-xl backdrop-blur-xl sm:block"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-cyan/15 text-brand-cyan">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-brand-text">Verified RND Review</p>
                    <p className="text-[10px] text-brand-muted">Clinical safety confirmed</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* PLATFORM INTELLIGENCE BENTO GRID */}
        <section id="platform" className="mx-auto max-w-[1440px] scroll-mt-24 px-5 py-20 sm:px-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6 }}
            className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end"
          >
            <div>
              <div className="eyebrow inline-flex items-center gap-2">
                <ScanLine className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Platform Intelligence
              </div>
              <h2 className="mt-4 max-w-lg font-display text-3xl font-black leading-[1.05] tracking-[-0.04em] text-brand-text sm:text-5xl">
                Personal enough to matter. Structured enough to trust.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-brand-muted lg:ml-auto lg:text-base">
              KAINARA unites the patient everyday routine with licensed nutritionist oversight and administrative
              governance. Every meal is grounded in verified science, never unchecked generative output.
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
                  className={`surface-panel group relative min-h-[260px] overflow-hidden rounded-[28px] p-7 transition duration-300 hover:border-emerald-500/40 ${item.className}`}
                >
                  <div className="absolute right-6 top-3 font-display text-8xl font-black tracking-tighter text-brand-text/[0.04] select-none">
                    {item.number}
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 transition-transform duration-300 group-hover:scale-110">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-8 max-w-md font-display text-xl font-extrabold tracking-tight text-brand-text">
                    {item.title}
                  </h3>
                  <p className="mt-2.5 max-w-xl text-sm leading-6 text-brand-muted">{item.text}</p>
                  <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-brand-accent via-emerald-400 to-brand-cyan transition-all duration-500 group-hover:w-full" />
                </motion.article>
              );
            })}
          </div>
        </section>

        {/* THE INTELLIGENCE LOOP (FOREST PINE SECTION) */}
        <section
          id="process"
          className="relative scroll-mt-20 border-y border-[#173e33] bg-[#071914] py-24 text-white overflow-hidden"
        >
          <div className="pointer-events-none absolute inset-0 futuristic-grid opacity-30" />
          <div className="pointer-events-none absolute -left-20 top-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-emerald-500/10 blur-[120px]" />
          <div className="pointer-events-none absolute -right-20 top-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-brand-cyan/10 blur-[120px]" />

          <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.6 }}
              className="mx-auto max-w-2xl text-center"
            >
              <div className="eyebrow inline-flex border-[#173e33] bg-[#0e271f] text-emerald-400">
                <CircleDot className="h-3.5 w-3.5" />
                The Intelligence Loop
              </div>
              <h2 className="mt-4 font-display text-3xl font-black tracking-[-0.04em] sm:text-5xl">
                Designed to learn without bypassing the clinical checkpoint.
              </h2>
              <p className="mt-4 text-sm sm:text-base text-white/60">
                A seamless 4-stage pipeline that ensures generative AI stays accountable to licensed professionals.
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
                    className="relative bg-[#091b15] p-7 md:min-h-[300px] hover:bg-[#0c241d] transition duration-300"
                  >
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/60">
                      Phase 0{index + 1}
                    </span>
                    <Icon className="mt-8 h-8 w-8 text-emerald-400" />
                    <h3 className="mt-6 font-display text-lg font-bold text-white">{step.title}</h3>
                    <p className="mt-2.5 text-xs leading-5 text-white/55">{step.text}</p>
                    {index < 3 && (
                      <ArrowRight className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 hidden h-5 w-5 text-emerald-400 md:block" />
                    )}
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        {/* NUTRITIONIST RND RECRUITMENT */}
        <section id="nutritionists" className="mx-auto max-w-[1440px] scroll-mt-24 px-5 py-24 sm:px-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7 }}
            className="futuristic-grid relative overflow-hidden rounded-[36px] bg-[#071914] p-8 text-white shadow-2xl sm:p-12 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:p-16 border border-[#173e33]"
          >
            <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-brand-cyan/15 blur-[120px]" />
            <div className="relative">
              <div className="eyebrow inline-flex border-[#173e33] bg-[#0e271f] text-emerald-400">
                <Stethoscope className="h-3.5 w-3.5" />
                For Registered Nutritionist-Dietitians
              </div>
              <h2 className="mt-6 max-w-2xl font-display text-3xl font-black leading-[1.05] tracking-[-0.04em] sm:text-5xl">
                Help keep AI-assisted nutrition clinically safe.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-white/60 sm:text-base">
                Apply online from anywhere in the Philippines to join KAINARA&apos;s accredited RND review council. Every
                application undergoes license credential screening and direct verification before audit access is granted.
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
                  className="inline-flex min-h-[52px] items-center justify-center gap-3 rounded-2xl border border-[#173e33] bg-[#0e271f] px-6 text-sm font-bold text-emerald-400 transition duration-200 hover:border-emerald-400/50 hover:text-white"
                >
                  Track Application Status
                </Link>
              </div>
            </div>

            <div className="relative mt-10 grid gap-3.5 lg:mt-0">
              {rndStages.map(({ icon: Icon, title, text }, index) => (
                <div
                  key={title}
                  className="flex gap-4 rounded-[22px] border border-[#173e33] bg-[#0e271f]/80 p-5 backdrop-blur-xl transition hover:border-emerald-500/40"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-emerald-400/70">
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
                <div className="eyebrow inline-flex items-center gap-2">
                  <BookOpenText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Evidence & Data Foundations
                </div>
                <h2 className="mt-4 max-w-xl font-display text-3xl font-black leading-[1.05] tracking-[-0.04em] text-brand-text sm:text-5xl">
                  Traceable scientific sources, with provenance kept clear.
                </h2>
              </div>
              <div className="max-w-2xl lg:ml-auto">
                <p className="text-sm leading-7 text-brand-muted sm:text-base">
                  KAINARA references peer-reviewed methods, FNRI Philippine food composition datasets, DOST clinical
                  standards, and attributed recipe archives. Provenance is transparently cited for full clinical auditability.
                </p>
                <Link
                  href="/docs#data-sources"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Read the complete evidence register <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>

            <div className="mt-12 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {EVIDENCE_SOURCES.map((source, index) => (
                <motion.a
                  key={source.id}
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.4, delay: index * 0.04 }}
                  whileHover={{ y: -4, transition: { duration: 0.15 } }}
                  className="group rounded-[22px] border border-brand-border/70 bg-brand-bg/80 p-4 transition hover:border-emerald-500/40 hover:shadow-md"
                  aria-label={`Open ${source.name} source`}
                >
                  <span className="flex h-10 w-fit min-w-10 items-center justify-center rounded-xl bg-emerald-500/10 px-2.5 font-mono text-[10px] font-black tracking-wider text-emerald-600 dark:text-emerald-400">
                    {source.mark}
                  </span>
                  <p className="mt-3.5 text-xs font-extrabold leading-5 text-brand-text group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {source.shortName}
                  </p>
                  <p className="mt-1.5 font-mono text-[8px] font-bold uppercase leading-4 tracking-[0.08em] text-brand-muted">
                    {EVIDENCE_STATUS_LABELS[source.status]}
                  </p>
                </motion.a>
              ))}
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
            <div className="p-8 sm:p-12 lg:p-16">
              <div className="eyebrow inline-flex items-center gap-2">
                <BookOpenText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Documentation & User Guide
              </div>
              <h2 className="mt-5 max-w-xl font-display text-3xl font-black leading-[1.05] tracking-[-0.04em] sm:text-5xl">
                The comprehensive guide to KAINARA.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-brand-muted sm:text-base">
                Explore our clinical safety framework, FNRI Philippine food composition tables, Mifflin-St Jeor macro
                algorithms, and nutritionist verification workflows.
              </p>
              <Link
                href="/docs"
                className="group mt-8 inline-flex min-h-12 items-center gap-3 rounded-2xl bg-brand-text px-6 text-sm font-bold text-brand-bg transition hover:-translate-y-0.5"
              >
                Explore Documentation
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>

            <div className="relative min-h-[420px] overflow-hidden bg-[#071914] p-7 text-white futuristic-grid sm:p-10 border-t lg:border-t-0 lg:border-l border-[#173e33]">
              <div className="absolute right-8 top-8 h-32 w-32 rounded-full bg-brand-cyan/15 blur-3xl" />
              <div className="relative grid h-full grid-cols-2 gap-4">
                <Link
                  href="/docs#clinical-guidelines"
                  className="group flex flex-col justify-end overflow-hidden rounded-[24px] border border-[#173e33] bg-[#091b15] p-5 transition hover:border-emerald-500/40 hover:bg-[#0c241d]"
                >
                  <ShieldCheck className="h-7 w-7 text-emerald-400 transition-transform group-hover:scale-110" />
                  <p className="mt-14 font-display text-base font-bold">Clinical Safety & Oversight</p>
                  <p className="mt-2 text-xs leading-5 text-white/50">
                    Contraindication checks, allergy gates, and verified RND review.
                  </p>
                </Link>
                <div className="grid gap-4">
                  <Link
                    href="/docs#meal-planning"
                    className="group rounded-[24px] border border-[#173e33] bg-[#091b15] p-5 transition hover:border-brand-cyan/40 hover:bg-[#0c241d]"
                  >
                    <Database className="h-6 w-6 text-brand-cyan transition-transform group-hover:scale-110" />
                    <p className="mt-6 text-sm font-bold">FNRI & Macro Engine</p>
                    <p className="mt-1 text-[11px] leading-4 text-white/50">
                      Mifflin-St Jeor TDEE & Philippine food data.
                    </p>
                  </Link>
                  <Link
                    href="/docs#help"
                    className="group rounded-[24px] border border-[#173e33] bg-[#091b15] p-5 transition hover:border-purple-400/40 hover:bg-[#0c241d]"
                  >
                    <Sparkles className="h-6 w-6 text-purple-400 transition-transform group-hover:scale-110" />
                    <p className="mt-6 text-sm font-bold">User Guides & FAQs</p>
                    <p className="mt-1 text-[11px] leading-4 text-white/50">
                      Starter bridge plans, meal swaps, and grocery lists.
                    </p>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* BOTTOM CALL TO ACTION */}
        <section className="px-5 pb-24 sm:px-8 lg:px-12">
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
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
                Your Next Meal Can Be Intentional
              </p>
              <h2 className="mt-3 max-w-2xl font-display text-3xl font-black tracking-[-0.04em] sm:text-4xl text-white">
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

      {/* FOOTER */}
      <footer className="border-t border-brand-border/70 bg-brand-surface/40">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 py-8 text-xs text-brand-muted sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <div className="flex items-center gap-2.5 font-display font-extrabold tracking-[0.14em] text-brand-text">
            <KainaraLogo size="sm" variant="gradient" />
            KAINARA
          </div>
          <p>© 2026 KAINARA. AI-assisted Filipino nutrition intelligence with clinical oversight.</p>
          <div className="flex gap-6 font-semibold">
            <Link href="/docs" className="transition hover:text-emerald-600 dark:hover:text-emerald-400">
              Documentation
            </Link>
            <Link href="/docs#data-sources" className="transition hover:text-emerald-600 dark:hover:text-emerald-400">
              Evidence Sources
            </Link>
            <Link href="/login" className="transition hover:text-emerald-600 dark:hover:text-emerald-400">
              Portal Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
