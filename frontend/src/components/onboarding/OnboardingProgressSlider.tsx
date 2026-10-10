'use client';

import React from 'react';
import { motion } from 'motion/react';

export interface OnboardingProgressSliderProps {
  currentStep: number;
  totalSteps?: number;
  className?: string;
}

const STEP_LABELS: Record<number, string> = {
  1: 'Personal Metrics',
  2: 'Dietary Preferences',
  3: 'Medical Conditions',
  4: 'Food Safety & Allergies',
  5: 'Grocery Schedule',
  6: 'Review & Terms',
};

export const OnboardingProgressSlider: React.FC<OnboardingProgressSliderProps> = ({
  currentStep,
  totalSteps = 6,
  className = '',
}) => {
  const clampedStep = Math.min(Math.max(currentStep, 1), totalSteps);
  const percentage = Math.round((clampedStep / totalSteps) * 100);

  return (
    <div className={`w-full flex flex-col gap-2 select-none ${className}`}>
      {/* Top Labels */}
      <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-brand-muted">
            Step {clampedStep} of {totalSteps}
          </span>
          {STEP_LABELS[clampedStep] && (
            <>
              <span className="text-brand-border dark:text-[#173e33]">·</span>
              <span className="font-sans text-[11px] font-bold text-brand-green tracking-normal capitalize">
                {STEP_LABELS[clampedStep]}
              </span>
            </>
          )}
        </div>
        <span className="font-mono text-[11px] text-brand-green font-bold">{percentage}% Completed</span>
      </div>

      {/* Adaptive Slider Track */}
      <div
        role="progressbar"
        aria-valuenow={clampedStep}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Onboarding progress: Step ${clampedStep} of ${totalSteps}`}
        className="relative isolate flex h-10 sm:h-11 w-full items-center overflow-hidden rounded-full border border-brand-border bg-[#f1f3f5] shadow-inner transition-colors dark:border-[#173e33] dark:bg-[#0e271f]"
      >
        {/* Step Notch Markers */}
        <div className="absolute inset-0 flex items-center justify-between px-5 pointer-events-none z-10">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((stepNum) => (
            <div
              key={stepNum}
              className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                stepNum <= clampedStep
                  ? 'bg-white/80 dark:bg-black/60 shadow-xs'
                  : 'bg-brand-border/60 dark:bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Dynamic Multi-stop Brand Gradient Fill */}
        <motion.div
          className="pointer-events-none absolute top-0 left-0 h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, #10b981 0%, #18b9d2 35%, #f09e6c 70%, #eb6a38 100%)',
          }}
          animate={{
            width: `calc(${percentage}% + ${(1 - percentage / 100) * 44}px)`,
          }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        />

        {/* Sliding Thumb Indicator */}
        <motion.div
          className="pointer-events-none absolute top-0 z-20 flex h-10 sm:h-11 w-10 sm:w-11 items-center justify-center rounded-full"
          data-onboarding-progress-thumb
          animate={{
            left: `calc(${percentage}% - ${(percentage / 100) * 44}px)`,
          }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          <div
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white shadow-[0_3px_12px_rgba(0,0,0,0.22)] ring-2 ring-black/5 dark:bg-brand-dark dark:ring-white/20"
            style={{
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.45)',
            }}
          >
            <span className="font-mono text-xs font-black text-brand-black dark:text-white">{clampedStep}</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default OnboardingProgressSlider;
