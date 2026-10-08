import {
  BadgeCheck,
  Database,
  Fingerprint,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Video,
  WandSparkles,
} from 'lucide-react';

export const evidenceSliderSources = [
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
];

// Organic SVG wave masks that terminate the sources showcase track exactly at the outer wave borders
export const leftTrackMaskSvg = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 300" preserveAspectRatio="none"><path d="M 22,-10 C 68,35 110,85 96,125 C 80,165 18,175 42,215 C 68,255 115,265 85,310 L 140,310 L 140,-10 Z" fill="#000"/></svg>'
)}")`;

export const rightTrackMaskSvg = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 300" preserveAspectRatio="none"><path d="M 0,-10 L 138,-10 C 92,45 45,80 62,135 C 78,185 142,180 118,225 C 94,270 42,275 72,310 L 0,310 Z" fill="#000"/></svg>'
)}")`;

export const capabilities = [
  {
    icon: Fingerprint,
    number: '01',
    title: 'Built around your health context',
    text: 'Your goals, allergies, preferences, conditions and shopping routine shape meal selection.',
    className: 'lg:col-span-2',
    iconStyles: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    numberStyles:
      'text-emerald-700/20 dark:text-emerald-400/25 group-hover:text-emerald-700/35 dark:group-hover:text-emerald-400/40',
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
    numberStyles:
      'text-brand-accent/25 dark:text-[#f09e6c]/30 group-hover:text-brand-accent/40 dark:group-hover:text-[#f09e6c]/45',
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
    numberStyles:
      'text-amber-600/25 dark:text-amber-400/30 group-hover:text-amber-600/40 dark:group-hover:text-amber-400/45',
    hoverBorder: 'hover:border-amber-500/50',
    accentBar: 'bg-gradient-to-r from-[#f09e6c] via-[#eb6a38] to-amber-400',
  },
];

export const loopSteps = [
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
    text: 'RNDs review profiles, meal cases and submitted recipes, recording decisions within each review’s scope.',
    color: 'text-brand-accent',
    bg: 'border-brand-accent/30 bg-brand-accent/15 text-brand-accent',
    phaseLabel: 'text-brand-accent',
    hoverBorder: 'hover:border-brand-accent/40',
    accentDot: 'bg-brand-accent shadow-[0_0_8px_rgba(235,106,56,0.8)]',
  },
];

export const rndStages = [
  {
    icon: BadgeCheck,
    title: 'Credential Review',
    text: 'Administrators review submitted PRC license details, education and professional background.',
    color: 'text-emerald-400',
    bg: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
    stepColor: 'text-emerald-400',
    hoverBorder: 'hover:border-emerald-500/40',
    accentDot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
  },
  {
    icon: Video,
    title: 'One-on-One Verification',
    text: 'Schedule and complete a direct online verification call with a KAINARA administrator.',
    color: 'text-brand-cyan',
    bg: 'border-brand-cyan/30 bg-brand-cyan/15 text-brand-cyan',
    stepColor: 'text-brand-cyan',
    hoverBorder: 'hover:border-brand-cyan/40',
    accentDot: 'bg-brand-cyan shadow-[0_0_8px_rgba(45,212,191,0.8)]',
  },
  {
    icon: ShieldCheck,
    title: 'Controlled Access',
    text: 'Approved applicants receive an account activation invitation for the RND workspace.',
    color: 'text-[#f09e6c]',
    bg: 'border-[#f09e6c]/30 bg-[#f09e6c]/15 text-[#f09e6c]',
    stepColor: 'text-[#f09e6c]',
    hoverBorder: 'hover:border-[#f09e6c]/40',
    accentDot: 'bg-[#f09e6c] shadow-[0_0_8px_rgba(240,158,108,0.8)]',
  },
];
