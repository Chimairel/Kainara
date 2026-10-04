import CardDecoration from '@/components/ui/CardDecoration';
import { Stethoscope, BadgeCheck, Video, KeyRound, FileText, ShieldCheck } from 'lucide-react';

const applicationStages = [
  {
    step: '01',
    title: 'Professional Application',
    text: 'Submit identity details, PRC license information, and a recent photo.',
    icon: FileText,
  },
  {
    step: '02',
    title: 'PRC Credential Review',
    text: 'Administrators verify PRC registration status and credentials.',
    icon: BadgeCheck,
  },
  {
    step: '03',
    title: '1-on-1 Video Verification',
    text: 'Short scheduled identity check with a KAINARA administrator.',
    icon: Video,
  },
  {
    step: '04',
    title: 'Privileged Workspace Invite',
    text: 'Approved RNDs receive a private activation link to review cases.',
    icon: KeyRound,
  },
];

export function ApplicationSidebar() {
  return (
    <aside className="relative overflow-hidden rounded-[32px] border border-[#173e33] bg-[#071914] p-6 sm:p-8 text-white shadow-2xl">
      {/* Brand Retro Wave Corner Accent (Matching landing page style) */}
      <CardDecoration style="varied" seed="ApplicationSidebar.tsx" />

      {/* Watermark Logo */}

      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 shadow-md">
            <Stethoscope className="h-5 w-5" />
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Nutritionist Applications
          </span>
        </div>

        <h1 className="mt-5 font-display text-2xl sm:text-3xl lg:text-4xl font-black leading-[1.05] tracking-[-0.04em]">
          Join the nutritionist team.
        </h1>
        <p className="mt-3 text-xs sm:text-sm leading-6 text-white/60">
          Registered nutritionist-dietitians from anywhere in the Philippines can apply online. Access is granted only
          after credential review and a one-on-one verification call.
        </p>

        {/* Verification Timeline / Connected Process */}
        <div className="mt-7">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#f09e6c]">
            Verification Pathway
          </p>
          <div className="mt-3 space-y-2.5">
            {applicationStages.map(({ step, title, text, icon: Icon }) => (
              <div
                key={step}
                className="group relative flex items-start gap-3.5 rounded-2xl border border-[#173e33] bg-[#0c241d]/70 p-3.5 backdrop-blur-sm transition duration-200 hover:border-emerald-500/40 hover:bg-[#0e2c23]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 font-mono text-xs font-bold text-white/80 group-hover:border-emerald-400/40 group-hover:text-emerald-300 transition-colors">
                  {step}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-white/40 group-hover:text-emerald-400 transition-colors" />
                    <h3 className="text-xs font-bold text-white">{title}</h3>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-4 text-white/50">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trust Safeguards */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 text-[11px] leading-5 text-white/60">
          <div className="flex items-center gap-2 font-semibold text-white/80">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Clinical Boundary Standards
          </div>
          <p className="mt-1">
            Submitting creates an application only. Workspace access requires administrator approval after credential
            review and an identity verification call.
          </p>
        </div>
      </div>
    </aside>
  );
}
