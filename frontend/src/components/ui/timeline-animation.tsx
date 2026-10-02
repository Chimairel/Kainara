'use client';

import React, { useEffect, useState } from 'react';
import { motion, type Variants } from 'motion/react';

export interface TimelineContentProps {
  as?: keyof typeof motion | 'div' | 'p' | 'span' | 'section' | 'article' | 'h1' | 'h2' | 'h3' | 'a';
  animationNum?: number;
  timelineRef?: React.RefObject<HTMLElement | null>;
  customVariants?: Variants;
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export function TimelineContent({
  as = 'div',
  animationNum = 0,
  timelineRef,
  customVariants,
  className,
  children,
  ...props
}: TimelineContentProps) {
  const [isInView, setIsInView] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }
    const target = timelineRef?.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [timelineRef]);

  const Component = (motion[as as keyof typeof motion] ?? motion.div) as React.ElementType;

  const defaultVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.15, duration: 0.5, ease: 'easeOut' },
    }),
  };

  const variants = customVariants || defaultVariants;

  return (
    <Component
      custom={animationNum}
      initial="hidden"
      animate={timelineRef ? (isInView ? 'visible' : 'hidden') : 'visible'}
      variants={variants}
      className={className}
      {...props}
    >
      {children}
    </Component>
  );
}

export default TimelineContent;
