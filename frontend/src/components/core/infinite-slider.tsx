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
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const [isPointerFocused, setIsPointerFocused] = useState(false);
  const [pointerActivated, setPointerActivated] = useState(false);
  const activationPoint = useRef<{ x: number; y: number } | null>(null);
  const pointerFocus = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<{ stop: () => void } | null>(null);
  const reducedMotion = useReducedMotion();
  const currentSpeed = isHovering && !pointerActivated && speedOnHover !== undefined ? speedOnHover : speed;
  const ref = useRef<HTMLDivElement>(null);
  const duplicateRef = useRef<HTMLDivElement>(null);
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const isStatic = reducedMotion || isKeyboardFocused;

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
      if (isKeyboardFocused && viewportRef.current?.contains(document.activeElement)) {
        (document.activeElement as HTMLElement).scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      }
      return;
    }
    if (typeof animate !== 'function' || currentSpeed <= 0 || isPointerFocused) return;
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

    animationRef.current = controls ?? null;
    return () => {
      controls?.stop();
      if (animationRef.current === controls) animationRef.current = null;
    };
  }, [
    key,
    isStatic,
    isKeyboardFocused,
    isPointerFocused,
    translation,
    currentSpeed,
    width,
    height,
    gap,
    isTransitioning,
    direction,
    reverse,
  ]);

  useEffect(() => {
    const resumePointerActivation = () => {
      if (!activationPoint.current) return; // Keyboard focus keeps its accessible static view.
      pointerFocus.current = false;
      setPointerActivated(true);
      setIsPointerFocused(false);
      setIsHovering(false);
      setIsTransitioning(true);
    };
    const visible = () => { if (document.visibilityState === 'visible') resumePointerActivation(); };
    window.addEventListener('focus', resumePointerActivation);
    window.addEventListener('pageshow', resumePointerActivation);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('focus', resumePointerActivation);
      window.removeEventListener('pageshow', resumePointerActivation);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);

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
      ref={viewportRef}
      onPointerDownCapture={() => {
        // Native pointer activation must retain the same link node and screen position.
        pointerFocus.current = true;
        activationPoint.current = null;
        setPointerActivated(false);
        animationRef.current?.stop();
        setIsTransitioning(true);
        setIsPointerFocused(true);
      }}
      onClickCapture={(event) => {
        if (pointerFocus.current) {
          activationPoint.current = { x: event.clientX, y: event.clientY };
          setPointerActivated(true);
          setIsPointerFocused(false);
          setIsHovering(false);
          setIsTransitioning(true);
        }
      }}
      onPointerMove={(event) => {
        // Returning to the tab can re-enter hover at the same pointer location.
        // A deliberate pointer move restores normal hover behavior.
        const point = activationPoint.current;
        if (point && (point.x !== event.clientX || point.y !== event.clientY)) {
          activationPoint.current = null;
          setPointerActivated(false);
        }
      }}
      onKeyDownCapture={(event) => {
        if (event.key === 'Tab') {
          pointerFocus.current = false;
          activationPoint.current = null;
          setPointerActivated(false);
        }
      }}
      onFocusCapture={() => {
        if (pointerFocus.current) setIsPointerFocused(true);
        else setIsKeyboardFocused(true);
      }}
      onPointerLeave={() => {
        if (!viewportRef.current?.contains(document.activeElement)) {
          pointerFocus.current = false;
          setIsPointerFocused(false);
        }
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          pointerFocus.current = false;
          setIsKeyboardFocused(false);
          setIsPointerFocused(false);
          setIsTransitioning(true);
        }
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
