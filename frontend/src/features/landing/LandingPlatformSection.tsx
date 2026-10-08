'use client';

import { motion } from 'motion/react';

import {
  // Capabilities copy: Your goals, allergies, preferences, conditions and shopping routine shape meal selection.
  capabilities,
} from '@/components/landing/landing-content';

export default function LandingPlatformSection() {
  return (
    <>
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
            KAINARA unites the patient everyday routine with licensed RND oversight and administrative review workflows.
            Recipe identity, nutrition estimates and case decisions have distinct roles in planning.
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
    </>
  );
}
