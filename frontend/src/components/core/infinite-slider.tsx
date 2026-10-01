'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useMotionValue, animate, motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

export type InfiniteSliderProps = {
  children: React.ReactNode;
  gap?: number;
  speed?: number;
  speedOnHover?: number;
  direction?: 'horizontal' | 'vertical';
  reverse?: boolean;
  className?: string;
};

export function InfiniteSlider({
  children,
  gap = 16,
  speed = 100,
  speedOnHover,
  direction = 'horizontal',
  reverse = false,
  className,
}: InfiniteSliderProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const reducedMotion = useReducedMotion();
  const currentSpeed = isHovering && speedOnHover !== undefined ? speedOnHover : speed;
  const ref = useRef<HTMLDivElement>(null);
  const duplicateRef = useRef<HTMLDivElement>(null);
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const isStatic = reducedMotion || isFocused;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setSize({ width, height });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    // The visual repeat stays clickable but must not repeat in keyboard navigation.
    duplicateRef.current
      ?.querySelectorAll<HTMLElement>('a, button, input, select, textarea, [tabindex]')
      .forEach((element) => element.setAttribute('tabindex', '-1'));
  }, [children, isStatic]);
  const translation = useMotionValue(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (isStatic) {
      translation.set(0);
      return;
    }
    if (typeof animate !== 'function' || currentSpeed <= 0) return;
    let controls: { stop: () => void } | undefined;
    const size = direction === 'horizontal' ? width : height;
    if (!size) return;
    const contentSize = size + gap;
    const from = reverse ? -contentSize : 0;
    const to = reverse ? 0 : -contentSize;

    const distanceToTravel = Math.abs(to - from);
    const duration = distanceToTravel / currentSpeed;

    if (isTransitioning) {
      const remainingDistance = Math.abs(translation.get() - to);
      const transitionDuration = remainingDistance / currentSpeed;

      controls = animate(translation, [translation.get(), to], {
        ease: 'linear',
        duration: transitionDuration,
        onComplete: () => {
          setIsTransitioning(false);
          setKey((prevKey) => prevKey + 1);
        },
      });
    } else {
      controls = animate(translation, [from, to], {
        ease: 'linear',
        duration: duration,
        repeat: Infinity,
        repeatType: 'loop',
        repeatDelay: 0,
        onRepeat: () => {
          translation.set(from);
        },
      });
    }

    return () => controls?.stop();
  }, [key, isStatic, translation, currentSpeed, width, height, gap, isTransitioning, direction, reverse]);

  const hoverProps =
    speedOnHover !== undefined
      ? {
          onHoverStart: () => {
            setIsTransitioning(true);
            setIsHovering(true);
          },
          onHoverEnd: () => {
            setIsTransitioning(true);
            setIsHovering(false);
          },
        }
      : {};

  return (
    <div
      className={cn(isStatic ? 'overflow-auto' : 'overflow-hidden', 'py-10 -my-10', className)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsFocused(false);
      }}
    >
      <motion.div
        className={cn('flex w-max', direction === 'horizontal' && 'items-center py-6')}
        style={{
          ...(direction === 'horizontal' ? { x: translation } : { y: translation }),
          gap: `${gap}px`,
          flexDirection: direction === 'horizontal' ? 'row' : 'column',
        }}
        {...hoverProps}
      >
        <div
          ref={ref}
          className="flex shrink-0"
          style={{ gap, flexDirection: direction === 'horizontal' ? 'row' : 'column' }}
        >
          {children}
        </div>
        {!isStatic && (
          <div
            ref={duplicateRef}
            aria-hidden="true"
            className="flex shrink-0"
            style={{ gap, flexDirection: direction === 'horizontal' ? 'row' : 'column' }}
          >
            {children}
          </div>
        )}
      </motion.div>
    </div>
  );
}
