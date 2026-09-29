'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenText,
  CircleDot,
  Database,
  Fingerprint,
  HeartPulse,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  WandSparkles,
  Activity,
  Flame,
  ChevronRight,
  Search,
  Award,
  SlidersHorizontal,
  Check,
  Lock,
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

// Interactive Simulator Data
type GoalType = 'weight-loss' | 'balanced' | 'diabetic' | 'high-protein';

interface MealPreview {
  name: string;
  category: 'Breakfast' | 'Lunch' | 'Dinner';
  image: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  tag: string;
}

interface GoalConfig {
  label: string;
  badge: string;
  targetKcal: number;
  carbsPct: number;
  proteinPct: number;
  fatPct: number;
  description: string;
  clinicalNote: string;
  meals: MealPreview[];
}

const GOALS_DATA: Record<GoalType, GoalConfig> = {
  'weight-loss': {
    label: 'Weight Loss & Lean Cut',
    badge: '-500 kcal Deficit',
    targetKcal: 1850,
    carbsPct: 45,
    proteinPct: 30,
    fatPct: 25,
    description: 'Calorie-controlled Filipino staples with higher dietary fiber and lean protein to preserve metabolic rate.',
    clinicalNote: 'Caloric target derived via Mifflin-St Jeor with moderate 500 kcal negative energy balance.',
    meals: [
      {
        name: 'Warm Pandesal & Scrambled Eggs with Malunggay',
        category: 'Breakfast',
        image: '/meals/pandesal.jpg',
        kcal: 380,
        protein: 22,
        carbs: 38,
        fat: 14,
        tag: 'High Iron • 22g Protein',
      },
      {
        name: 'Grilled Yellowfin Tuna with Ensaladang Talbos ng Kamote',
        category: 'Lunch',
        image: '/meals/tuna-bowl.jpg',
        kcal: 460,
        protein: 48,
        carbs: 24,
        fat: 16,
        tag: 'Rich in Omega-3',
      },
      {
        name: 'Ginisang Monggo with Crispy Tofu & Dahon ng Ampalaya',
        category: 'Dinner',
        image: '/meals/tofu-bowl.jpg',
        kcal: 410,
        protein: 28,
        carbs: 45,
        fat: 11,
        tag: 'Plant Protein & Fiber',
      },
    ],
  },
  'balanced': {
    label: 'Balanced Energy & Wellness',
    badge: 'Maintenance TDEE',
    targetKcal: 2150,
    carbsPct: 50,
    proteinPct: 25,
    fatPct: 25,
    description: 'Sustained energy tailored for urban professionals, balancing complex carbohydrates and essential micronutrients.',
    clinicalNote: 'Meets DOST-FNRI Recommended Dietary Allowances (PDRI) for active Filipino adults.',
    meals: [
      {
        name: 'Rolled Oats Bowl with Mango & Soy Milk',
        category: 'Breakfast',
        image: '/meals/oatmeal.jpg',
        kcal: 420,
        protein: 18,
        carbs: 64,
        fat: 11,
        tag: 'Sustained Energy',
      },
      {
        name: 'Bistek Tagalog with Brown Rice & Calamansi Onions',
        category: 'Lunch',
        image: '/meals/beef-bowl.jpg',
        kcal: 560,
        protein: 44,
        carbs: 52,
        fat: 18,
        tag: 'Bioavailable Iron',
      },
      {
        name: 'Chicken Tinola with Sayote, Ginger Broth & Sili Greens',
        category: 'Dinner',
        image: '/meals/placeholder-dinner.jpg',
        kcal: 480,
        protein: 42,
        carbs: 32,
        fat: 14,
        tag: 'Gut Soothing & Vitamin C',
      },
    ],
  },
  'diabetic': {
    label: 'Type 2 Diabetes & Low Glycemic',
    badge: 'Low Glycemic Index',
    targetKcal: 1900,
    carbsPct: 40,
    proteinPct: 35,
    fatPct: 25,
    description: 'Strict carbohydrate distribution to prevent postprandial blood sugar spikes, utilizing low-GI local vegetables.',
    clinicalNote: 'Carbohydrate limited to <45g per meal with elevated dietary soluble fiber (>25g daily).',
    meals: [
      {
        name: 'Soft Scrambled Eggs with Steamed Okra Relish',
        category: 'Breakfast',
        image: '/meals/scrambled-egg-rice.jpg',
        kcal: 360,
        protein: 26,
        carbs: 18,
        fat: 18,
        tag: 'Zero Sugar • High Mucilage',
      },
      {
        name: 'Spiced Tofu Stir-Fry with Kangkong & Cauliflower Rice',
        category: 'Lunch',
        image: '/meals/tofu-bowl.jpg',
        kcal: 430,
        protein: 34,
        carbs: 26,
        fat: 16,
        tag: 'Low Glycemic Impact',
      },
      {
        name: 'Sinigang na Bangus in Sampaloc Broth with Radish & Mustasa',
        category: 'Dinner',
        image: '/meals/tuna-bowl.jpg',
        kcal: 450,
        protein: 42,
        carbs: 22,
        fat: 17,
        tag: 'Clean Broth • Low Sodium',
      },
    ],
  },
  'high-protein': {
    label: 'High Protein & Muscle Recovery',
    badge: '+300 kcal Surplus',
    targetKcal: 2450,
    carbsPct: 45,
    proteinPct: 35,
    fatPct: 20,
    description: 'Macro-dense plans prioritizing lean meats, eggs, and legumes for athletes and active fitness practitioners.',
    clinicalNote: 'Targeting 1.8g to 2.2g protein per kg of bodyweight to maximize muscle protein synthesis.',
    meals: [
      {
        name: 'Lean Beef Tapa with Garlic Rice & Sunny Egg',
        category: 'Breakfast',
        image: '/meals/beef-bowl.jpg',
        kcal: 580,
        protein: 52,
        carbs: 58,
        fat: 16,
        tag: '52g High-Bio Protein',
      },
      {
        name: 'Grilled Pork Loin Inasal with Atchara & Brown Rice',
        category: 'Lunch',
        image: '/meals/pork-bowl.jpg',
        kcal: 640,
        protein: 56,
        carbs: 62,
        fat: 17,
        tag: 'Lean Cut • Essential BCAAs',
      },
      {
        name: 'Tuna Steak in Garlic Pepper Gravy with Steamed Greens',
        category: 'Dinner',
        image: '/meals/tuna-bowl.jpg',
        kcal: 520,
        protein: 54,
        carbs: 34,
        fat: 15,
        tag: '54g Protein • Low Fat',
      },
    ],
  },
};

const loopSteps = [
  {
    icon: Fingerprint,
    title: 'Biometric Intake',
    desc: 'Mifflin-St Jeor energy calculations calibrated against health goals, allergies, and lifestyle.',
    tag: 'Phase 01',
  },
  {
    icon: Database,
    title: 'FNRI Library Match',
    desc: 'Matches compatible verified Filipino meals audited by licensed nutritionists before generating anew.',
    tag: 'Phase 02',
  },
  {
    icon: WandSparkles,
    title: 'AI Synthesis with Guardrails',
    desc: 'Gemini AI constructs recipes strictly filling unmet macros, tagged with unverified status.',
    tag: 'Phase 03',
  },
  {
    icon: Stethoscope,
    title: 'Licensed RND Audit',
    desc: 'PRC-credentialed nutritionists audit recipes, approving them into the permanent verified library.',
    tag: 'Phase 04',
  },
];

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Interactive Hero Cockpit Tab State
  const [activeCockpitTab, setActiveCockpitTab] = useState<'cockpit' | 'rnd' | 'fnri'>('cockpit');

  // Interactive Live Simulator State
  const [selectedGoal, setSelectedGoal] = useState<GoalType>('balanced');

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

  const currentGoalData = GOALS_DATA[selectedGoal];

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text selection:bg-brand-accent selection:text-white">
      {/* Top Clinical Trust Bar */}
      <div className="border-b border-brand-border/60 bg-[#071914] px-4 py-2.5 text-center text-xs text-white/80">
        <div className="mx-auto flex max-w-[1440px] items-center justify-center gap-3 font-mono text-[11px] uppercase tracking-wider">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-emerald-400">DOST-FNRI 2024 Composition Engine</span>
          <span className="hidden sm:inline text-white/30">•</span>
          <span className="hidden sm:inline text-white/70">PRC-Licensed RND Oversight</span>
          <span className="hidden md:inline text-white/30">•</span>
          <span className="hidden md:inline text-brand-accent font-semibold">Zero Unchecked AI Hallucinations</span>
        </div>
      </div>

      <PublicHeader />

      <main className="overflow-x-clip">
        {/* HERO SECTION WITH 3D PERSPECTIVE COCKPIT */}
        <section className="relative overflow-hidden pt-8 pb-20 md:pt-14 md:pb-28">
          {/* Ambient Lighting Gradients */}
          <div className="pointer-events-none absolute left-[8%] top-12 h-[500px] w-[500px] rounded-full bg-emerald-500/15 blur-[140px] dark:bg-emerald-500/10" />
          <div className="pointer-events-none absolute right-[5%] top-20 h-[480px] w-[480px] rounded-full bg-brand-cyan/15 blur-[150px] dark:bg-brand-cyan/10" />
          <div className="pointer-events-none absolute left-1/3 bottom-0 h-[360px] w-[600px] rounded-full bg-brand-accent/10 blur-[150px] dark:bg-brand-accent/5" />

          <div className="mx-auto grid min-h-[calc(100vh-140px)] max-w-[1440px] items-center gap-12 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:px-12">
            {/* Left Headline & Action Column */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 max-w-2xl"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-400 backdrop-blur-md mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span>Clinical Filipino Nutrition Intelligence</span>
              </div>

              <h1 className="font-display text-[clamp(2.75rem,5.2vw,6.8rem)] font-black leading-[0.92] tracking-[-0.055em] text-brand-text">
                Eat with intention.
                <span className="text-gradient block pb-2">Ground in science.</span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-brand-muted sm:text-lg sm:leading-8">
                KAINARA transforms clinical biometrics into culturally authentic Filipino meal plans. Powered by Google
                Gemini and DOST-FNRI nutrition tables, every meal is audited by licensed nutritionist-dietitians.
              </p>

              <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:items-center">
                <Link
                  href={workspaceHref}
                  className="group flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-brand-accent px-8 text-sm font-extrabold text-white shadow-neon transition duration-200 hover:-translate-y-1 hover:brightness-110 active:scale-[0.98]"
                >
                  {workspaceLabel}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <a
                  href="#simulator"
                  className="group flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-brand-border/80 bg-brand-surface/75 px-6 text-sm font-bold text-brand-text backdrop-blur-xl transition duration-200 hover:-translate-y-1 hover:border-emerald-500/40 hover:bg-brand-surface"
                >
                  <SlidersHorizontal className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Try Live Meal Simulator
                  <ChevronRight className="h-4 w-4 text-brand-muted transition-transform group-hover:translate-x-0.5" />
                </a>
              </div>

              {/* Verified Safeguards Strip */}
              <div className="mt-10 grid max-w-xl grid-cols-3 gap-3 border-t border-brand-border/70 pt-6">
                {[
                  ['7 Days', 'Personalized Cycle', Flame],
                  ['PRC RND', 'Clinical Review Loop', ShieldCheck],
                  ['1,500+', 'FNRI Philippine Foods', Database],
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
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-brand-muted">
                        {label as string}
                      </p>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Right Interactive Cockpit Showcase with 3D Perspective */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="relative mx-auto w-full max-w-[740px] lg:ml-auto"
            >
              {/* Cockpit Interactive Switcher */}
              <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#173e33] bg-[#071914]/90 p-1.5 backdrop-blur-xl shadow-lg">
                <div className="flex gap-1">
                  {[
                    { id: 'cockpit', label: 'Patient Cockpit', icon: Activity },
                    { id: 'rnd', label: 'RND Audit Queue', icon: Stethoscope },
                    { id: 'fnri', label: 'FNRI Database', icon: Database },
                  ].map((tab) => {
                    const TabIcon = tab.icon;
                    const isActive = activeCockpitTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveCockpitTab(tab.id as typeof activeCockpitTab)}
                        className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                          isActive
                            ? 'bg-emerald-500 text-[#071914] shadow-md'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <TabIcon className="h-3.5 w-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 font-mono text-[10px] text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Interactive Preview
                </span>
              </div>

              {/* Main 3D Tilted Frame */}
              <div className="relative group [perspective:1400px]">
                <div className="relative overflow-hidden rounded-[30px] border border-[#173e33] bg-[#071914] p-3 shadow-2xl transition duration-500 transform-gpu group-hover:rotate-x-1 group-hover:-rotate-y-1">
                  {/* Window Chrome Header */}
                  <div className="flex items-center justify-between border-b border-[#173e33] bg-[#0a1c17] px-4 py-3 rounded-t-[22px]">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
                      <span className="ml-2 font-mono text-[10px] text-white/50">
                        app.kainara.ph/{activeCockpitTab}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-[#0e271f] px-2.5 py-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
                      <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400 font-bold">
                        Live Cockpit • Manila, PH
                      </span>
                    </div>
                  </div>

                  {/* Window Body (Swappable Views) */}
                  <div className="relative min-h-[380px] bg-[#071914] p-4 text-white overflow-hidden rounded-b-[22px]">
                    <AnimatePresence mode="wait">
                      {activeCockpitTab === 'cockpit' && (
                        <motion.div
                          key="cockpit-view"
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.3 }}
                          className="relative"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/dashboard-actual.png"
                            alt="KAINARA Clinical Nutrition Cockpit"
                            className="w-full h-auto rounded-xl object-cover object-top border border-[#173e33]"
                            loading="eager"
                          />
                        </motion.div>
                      )}

                      {activeCockpitTab === 'rnd' && (
                        <motion.div
                          key="rnd-view"
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.3 }}
                          className="space-y-3.5 p-2"
                        >
                          <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-[#0e271f] p-3 text-xs">
                            <div className="flex items-center gap-2.5">
                              <Stethoscope className="h-4 w-4 text-emerald-400" />
                              <span className="font-bold">Active RND Review Claim: Patient #9042</span>
                            </div>
                            <span className="font-mono text-emerald-400 bg-black/40 px-2 py-0.5 rounded text-[11px]">
                              28:14 lock left
                            </span>
                          </div>

                          <div className="grid gap-2.5">
                            {[
                              {
                                meal: 'Sinigang na Bangus with Kangkong',
                                status: 'NEEDS_REVIEW',
                                statusColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                                reason: 'Diabetic Profile — Sodium threshold check',
                              },
                              {
                                meal: 'Ginisang Monggo with Malunggay & Tofu',
                                status: 'APPROVED',
                                statusColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                                reason: 'FNRI Code: A01-0492 — Verified Clean',
                              },
                              {
                                meal: 'Chicken Tinola with Ginger & Chili Greens',
                                status: 'CAUTION',
                                statusColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
                                reason: 'Mild Hypertension — Low broth sodium required',
                              },
                            ].map((item) => (
                              <div
                                key={item.meal}
                                className="flex items-center justify-between rounded-xl border border-[#173e33] bg-[#091b15] p-3 text-xs"
                              >
                                <div>
                                  <p className="font-bold text-white">{item.meal}</p>
                                  <p className="text-[11px] text-white/50">{item.reason}</p>
                                </div>
                                <span
                                  className={`px-2 py-1 rounded-md text-[9px] font-mono font-bold border ${item.statusColor}`}
                                >
                                  {item.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {activeCockpitTab === 'fnri' && (
                        <motion.div
                          key="fnri-view"
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.3 }}
                          className="space-y-3 p-2"
                        >
                          <div className="flex items-center gap-2 rounded-xl border border-[#173e33] bg-[#091b15] px-3 py-2 text-xs text-white/60">
                            <Search className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Lookup FNRI Philippine Food Composition Database...</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-xl border border-[#173e33] bg-[#091b15] p-3">
                              <p className="font-mono text-[9px] text-emerald-400 uppercase">FNRI Code: F01-002</p>
                              <p className="font-bold text-white mt-1">Bangus (Milkfish, Fresh)</p>
                              <p className="text-[10px] text-white/50 mt-1">148 kcal • 20.5g P • 6.7g F • 0g C</p>
                              <div className="mt-2 text-[9px] text-white/40">Rich in EPA/DHA Omega-3</div>
                            </div>
                            <div className="rounded-xl border border-[#173e33] bg-[#091b15] p-3">
                              <p className="font-mono text-[9px] text-emerald-400 uppercase">FNRI Code: V03-041</p>
                              <p className="font-bold text-white mt-1">Malunggay Leaves (Moringa)</p>
                              <p className="text-[10px] text-white/50 mt-1">64 kcal • 9.4g P • 1.4g F • 8.3g C</p>
                              <div className="mt-2 text-[9px] text-white/40">440mg Calcium • 7mg Iron</div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Floating Badges (Visible only on Cockpit view so they don't obscure RND table or FNRI DB) */}
                {activeCockpitTab === 'cockpit' && (
                  <>
                    {/* Floating Calorie Ring Pill (Top Left) */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute -left-6 top-16 z-30 hidden w-48 rounded-2xl border border-emerald-500/40 bg-[#071914]/95 p-3.5 text-white shadow-2xl backdrop-blur-xl sm:block"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                          <HeartPulse className="h-3.5 w-3.5" />
                          Target Calorie
                        </div>
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      </div>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="font-display text-2xl font-black text-white">2,150</span>
                        <span className="text-[10px] font-semibold text-emerald-300/70">kcal / day</span>
                      </div>
                      <div className="mt-2.5">
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

                    {/* Floating Verified RND Stamp (Bottom Right) */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1, y: [0, 6, 0] }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute -bottom-6 -right-3 z-30 hidden w-60 rounded-2xl border border-brand-cyan/40 bg-[#071914]/95 p-3.5 text-white shadow-2xl backdrop-blur-xl sm:block"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-cyan/20 text-brand-cyan">
                          <ShieldCheck className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-xs font-bold text-white">Verified by Licensed RND</p>
                          <p className="text-[10px] text-white/60">PRC #0084921 • Audited Plan</p>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </section>

        {/* INTERACTIVE FEATURE: LIVE PHILIPPINE MACRO & MEAL SIMULATOR */}
        <section id="simulator" className="mx-auto max-w-[1440px] scroll-mt-24 px-5 py-20 sm:px-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6 }}
            className="rounded-[36px] border border-brand-border/80 bg-brand-surface/70 p-6 shadow-2xl backdrop-blur-xl sm:p-10 lg:p-12"
          >
            {/* Header with Eyebrow */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-8 border-b border-brand-border/70">
              <div>
                <div className="eyebrow inline-flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Interactive Intake Simulator
                </div>
                <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.04em] text-brand-text sm:text-4xl">
                  Test your nutrition goal in real-time.
                </h2>
                <p className="mt-2 text-sm text-brand-muted max-w-xl">
                  Choose a health target to witness how KAINARA configures Mifflin-St Jeor macros and curates authentic
                  Filipino meals instantly.
                </p>
              </div>

              {/* Goal Selector Buttons */}
              <div className="flex flex-wrap gap-2">
                {(Object.keys(GOALS_DATA) as GoalType[]).map((goalKey) => {
                  const goal = GOALS_DATA[goalKey];
                  const isSelected = selectedGoal === goalKey;
                  return (
                    <button
                      key={goalKey}
                      type="button"
                      onClick={() => setSelectedGoal(goalKey)}
                      className={`rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all duration-200 ${
                        isSelected
                          ? 'bg-brand-accent text-white shadow-neon scale-[1.02]'
                          : 'border border-brand-border/70 bg-brand-bg hover:border-emerald-500/40 text-brand-text'
                      }`}
                    >
                      {goal.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Results Body */}
            <div className="mt-8 grid gap-8 lg:grid-cols-[0.38fr_0.62fr] items-start">
              {/* Macro & Energy Card */}
              <div className="rounded-[28px] border border-[#173e33] bg-[#071914] p-6 text-white shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400 font-bold">
                    Computed Target
                  </span>
                  <span className="rounded-full bg-brand-accent/20 px-2.5 py-1 font-mono text-[10px] font-bold text-brand-accent">
                    {currentGoalData.badge}
                  </span>
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-4xl font-black text-white">{currentGoalData.targetKcal}</span>
                  <span className="text-sm font-semibold text-white/60">kcal / daily</span>
                </div>

                <p className="mt-3 text-xs leading-5 text-white/70">{currentGoalData.description}</p>

                {/* Macro Ratio Meter */}
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-emerald-400">Carbs {currentGoalData.carbsPct}%</span>
                    <span className="text-brand-accent">Protein {currentGoalData.proteinPct}%</span>
                    <span className="text-brand-cyan">Fat {currentGoalData.fatPct}%</span>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-white/10 gap-1 p-0.5">
                    <div
                      style={{ width: `${currentGoalData.carbsPct}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-500"
                    />
                    <div
                      style={{ width: `${currentGoalData.proteinPct}%` }}
                      className="h-full rounded-full bg-brand-accent transition-all duration-500"
                    />
                    <div
                      style={{ width: `${currentGoalData.fatPct}%` }}
                      className="h-full rounded-full bg-brand-cyan transition-all duration-500"
                    />
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-[11px] leading-5 text-white/60">
                  <span className="font-bold text-white">Clinical Note: </span>
                  {currentGoalData.clinicalNote}
                </div>

                <Link
                  href={workspaceHref}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-black text-[#071914] shadow-md transition hover:brightness-110"
                >
                  Generate 7-Day Plan with this Goal
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Curated Authentic Filipino Meals Grid */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-brand-muted">
                  <span>Authentic Filipino Meals Curated for this Goal</span>
                  <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                    DOST-FNRI Matched
                  </span>
                </div>

                <div className="grid gap-3.5 sm:grid-cols-3">
                  {currentGoalData.meals.map((meal) => (
                    <div
                      key={meal.name}
                      className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-brand-border/70 bg-brand-bg p-3.5 transition duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-lg"
                    >
                      <div>
                        <div className="relative h-28 w-full overflow-hidden rounded-xl bg-brand-surface">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={meal.image}
                            alt={meal.name}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />
                          <span className="absolute left-2 top-2 rounded-md bg-[#071914]/80 px-2 py-0.5 font-mono text-[9px] font-bold text-white backdrop-blur-md">
                            {meal.category}
                          </span>
                        </div>

                        <h4 className="mt-3 text-xs font-bold leading-tight text-brand-text line-clamp-2">
                          {meal.name}
                        </h4>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-brand-border/60">
                        <div className="flex items-baseline justify-between">
                          <span className="font-display text-sm font-black text-brand-text">{meal.kcal} kcal</span>
                          <span className="font-mono text-[10px] font-bold text-brand-muted">
                            {meal.protein}g P • {meal.carbs}g C
                          </span>
                        </div>
                        <span className="mt-1.5 inline-block text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                          {meal.tag}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* REIMAGINED BENTO GRID: HIGH-DENSITY VISUAL INTELLIGENCE */}
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
                Platform Capabilities
              </div>
              <h2 className="mt-4 max-w-lg font-display text-3xl font-black leading-[1.05] tracking-[-0.04em] text-brand-text sm:text-5xl">
                Personal enough to matter. Structured enough to trust.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-brand-muted lg:ml-auto lg:text-base">
              KAINARA connects clinical biometric intake with official Philippine food database matching and registered
              nutritionist oversight. Generative AI is strictly constrained to approved nutritional boundaries.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {/* Bento Card 1: Clinical Biometric Intake (Span 2) */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="surface-panel relative overflow-hidden rounded-[30px] p-7 lg:col-span-2 border border-brand-border/80"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Fingerprint className="h-6 w-6" />
                </div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-muted">Feature 01</span>
              </div>

              <h3 className="mt-6 font-display text-2xl font-black text-brand-text">
                Biometric & Medical Contraindication Engine
              </h3>
              <p className="mt-2 text-sm text-brand-muted max-w-xl">
                Every calculation anchors to Mifflin-St Jeor TDEE formulas, clinical condition flags (Type 2 Diabetes,
                Hypertension, CKD), and food allergies.
              </p>

              {/* Interactive Visual Chip Preview inside Bento */}
              <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
                <div className="rounded-xl border border-brand-border/70 bg-brand-bg/80 p-3 text-xs">
                  <span className="font-mono text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                    Formula Engine
                  </span>
                  <p className="font-bold text-brand-text mt-1">Mifflin-St Jeor</p>
                  <p className="text-[10px] text-brand-muted">BMR + Physical Activity Level</p>
                </div>
                <div className="rounded-xl border border-brand-border/70 bg-brand-bg/80 p-3 text-xs">
                  <span className="font-mono text-[9px] text-brand-accent font-bold uppercase">Clinical Guard</span>
                  <p className="font-bold text-brand-text mt-1">Allergy & Condition Filter</p>
                  <p className="text-[10px] text-brand-muted">Automatic ingredient blocking</p>
                </div>
                <div className="rounded-xl border border-brand-border/70 bg-brand-bg/80 p-3 text-xs">
                  <span className="font-mono text-[9px] text-brand-cyan font-bold uppercase">Schedule Anchor</span>
                  <p className="font-bold text-brand-text mt-1">Shopping Day Cycles</p>
                  <p className="text-[10px] text-brand-muted">Weekend or Midweek Fresh Prep</p>
                </div>
              </div>
            </motion.div>

            {/* Bento Card 2: DOST-FNRI Food Tables */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="surface-panel relative overflow-hidden rounded-[30px] p-7 border border-brand-border/80"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-cyan/10 text-brand-cyan">
                  <Database className="h-6 w-6" />
                </div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-muted">Feature 02</span>
              </div>

              <h3 className="mt-6 font-display text-xl font-black text-brand-text">FNRI Philippine Database</h3>
              <p className="mt-2 text-sm text-brand-muted">
                1,500+ verified Filipino food items matched against local palengke ingredients, avoiding inaccessible
                Western substitutes.
              </p>

              <div className="mt-6 rounded-2xl border border-brand-cyan/20 bg-brand-cyan/5 p-4 text-xs">
                <div className="flex items-center gap-2 font-mono text-[10px] text-brand-cyan font-bold">
                  <Check className="h-3.5 w-3.5" />
                  Exact Macro & Micro Composition
                </div>
                <p className="mt-2 text-[11px] text-brand-muted">
                  Grounded in Philippine Food and Nutrition Research Institute published datasets.
                </p>
              </div>
            </motion.div>

            {/* Bento Card 3: Transparent Nutritionist Audit */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="surface-panel relative overflow-hidden rounded-[30px] p-7 border border-brand-border/80"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-muted">Feature 03</span>
              </div>

              <h3 className="mt-6 font-display text-xl font-black text-brand-text">Review-Aware by Design</h3>
              <p className="mt-2 text-sm text-brand-muted">
                AI-synthesized meals remain visibly in review until verified by a licensed RND. There are zero invisible
                or ghost approval states.
              </p>

              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs">
                <Lock className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-[11px] font-semibold text-brand-text">
                  Nutritionist Audit Queue with 30-min claim locking
                </span>
              </div>
            </motion.div>

            {/* Bento Card 4: Smart Anti-Repetition Meal Library (Span 2) */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="surface-panel relative overflow-hidden rounded-[30px] p-7 lg:col-span-2 border border-brand-border/80"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-500">
                  <Sparkles className="h-6 w-6" />
                </div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-muted">Feature 04</span>
              </div>

              <h3 className="mt-6 font-display text-2xl font-black text-brand-text">
                3-Day Anti-Repetition & Atomic Swapping
              </h3>
              <p className="mt-2 text-sm text-brand-muted max-w-xl">
                Plans avoid repetitive monotony via a 3-day slot rotation algorithm. Need to change a dish? Swap
                atomically from verified recipes with an automatic ±15% calorie delta warning.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {['Day 1: Tinola', 'Day 2: Sinigang', 'Day 3: Monggo', 'Day 4: Bistek'].map((day, idx) => (
                  <div
                    key={day}
                    className="flex items-center gap-2 rounded-xl border border-brand-border/70 bg-brand-bg px-3.5 py-2 text-xs font-bold"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>{day}</span>
                    {idx < 3 && <ChevronRight className="h-3 w-3 text-brand-muted" />}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* THE INTELLIGENCE LOOP (FOREST PINE SECTION) */}
        <section
          id="process"
          className="relative scroll-mt-20 border-y border-[#173e33] bg-[#071914] py-24 text-white overflow-hidden"
        >
          <div className="pointer-events-none absolute inset-0 futuristic-grid opacity-30" />
          <div className="pointer-events-none absolute -left-20 top-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-emerald-500/10 blur-[130px]" />
          <div className="pointer-events-none absolute -right-20 top-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-brand-cyan/10 blur-[130px]" />

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
                Designed to learn without bypassing the human checkpoint.
              </h2>
              <p className="mt-4 text-sm sm:text-base text-white/60">
                A closed-loop clinical architecture connecting patient biometric intake, FNRI matching, AI recipe
                synthesis, and licensed RND approval.
              </p>
            </motion.div>

            <div className="mt-16 grid gap-px overflow-hidden rounded-[28px] border border-[#173e33] bg-[#173e33]/60 md:grid-cols-4">
              {loopSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.article
                    key={step.title}
                    initial={{ opacity: 0, y: 25 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.5, delay: index * 0.12 }}
                    className="relative bg-[#091b15] p-7 md:min-h-[290px] hover:bg-[#0c241d] transition duration-300"
                  >
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/70">
                      {step.tag}
                    </span>
                    <Icon className="mt-8 h-8 w-8 text-emerald-400" />
                    <h3 className="mt-6 font-display text-lg font-bold text-white">{step.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-white/55">{step.desc}</p>
                    {index < 3 && (
                      <ArrowRight className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 hidden h-5 w-5 text-emerald-400 md:block" />
                    )}
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        {/* NUTRITIONIST RND VIP PORTAL (WITH STRIPED ID BADGE DESIGN) */}
        <section id="nutritionists" className="mx-auto max-w-[1440px] scroll-mt-24 px-5 py-24 sm:px-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7 }}
            className="futuristic-grid relative overflow-hidden rounded-[36px] bg-[#071914] p-8 text-white shadow-2xl sm:p-12 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:p-16 border border-[#173e33]"
          >
            <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-brand-cyan/15 blur-[120px]" />

            {/* Left Content */}
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
                applicant undergoes license credential screening and a one-on-one interview before audit privileges are
                issued.
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

            {/* Right: Modern Striped RND ID Badge Showcase */}
            <div className="relative mt-10 lg:mt-0 flex flex-col justify-center">
              <div className="relative overflow-hidden rounded-[26px] border border-[#173e33] bg-[#0a1c17] shadow-2xl backdrop-blur-xl">
                {/* Diagonal Stripes Header */}
                <div className="h-6 w-full bg-[repeating-linear-gradient(45deg,#eb6a38,#eb6a38_10px,#071914_10px,#071914_20px)] opacity-80" />

                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-400 font-bold">
                        Professional Regulatory Commission (PRC)
                      </span>
                      <h4 className="mt-1 font-display text-lg font-bold text-white">Registered Nutritionist-Dietitian</h4>
                      <p className="text-xs text-white/50">KAINARA Clinical Review Board</p>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                      <Award className="h-5 w-5" />
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[#173e33] pt-4 text-xs">
                    <div>
                      <p className="font-mono text-[9px] text-white/40 uppercase">License Status</p>
                      <p className="font-bold text-emerald-400 mt-0.5">Verified Active</p>
                    </div>
                    <div>
                      <p className="font-mono text-[9px] text-white/40 uppercase">PRC ID Mask</p>
                      <p className="font-mono font-bold text-white mt-0.5">0084***-RND</p>
                    </div>
                    <div>
                      <p className="font-mono text-[9px] text-white/40 uppercase">Audit Scope</p>
                      <p className="font-semibold text-white/80 mt-0.5">Metabolic & Renal</p>
                    </div>
                    <div>
                      <p className="font-mono text-[9px] text-white/40 uppercase">Queue Access</p>
                      <p className="font-semibold text-white/80 mt-0.5">National Level</p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] text-white/60">
                    <span className="font-bold text-emerald-400">3-Step Verification: </span>
                    PRC License Audit → 1-on-1 Verification Call → Controlled Cryptographic Access.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* EVIDENCE AND SCIENTIFIC DATA FOUNDATIONS */}
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
                  <BookOpenText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Evidence & Data Foundations
                </div>
                <h2 className="mt-4 max-w-xl font-display text-3xl font-black leading-[1.05] tracking-[-0.04em] text-brand-text sm:text-5xl">
                  Traceable scientific sources, with provenance kept clear.
                </h2>
              </div>
              <div className="max-w-2xl lg:ml-auto">
                <p className="text-sm leading-7 text-brand-muted sm:text-base">
                  KAINARA references peer-reviewed methods, FNRI Philippine food composition datasets, DOST clinical
                  standards, and attributed recipe archives. Provenance is transparently cited for full clinical
                  auditability.
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
