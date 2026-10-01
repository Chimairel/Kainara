'use client';
import React, { useRef } from 'react';
import { useScroll, useTransform, motion, MotionValue, UseScrollOptions } from 'motion/react';

export const ContainerScroll = ({
  titleComponent,
  children,
  className,
  containerClassName,
  innerClassName,
  cardClassName,
  badgeLeft,
  badgeRight,
  layout = 'side-by-side',
  offset = ['start start', 'end start'],
}: {
  titleComponent?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  innerClassName?: string;
  cardClassName?: string;
  badgeLeft?: React.ReactNode;
  badgeRight?: React.ReactNode;
  layout?: 'side-by-side' | 'stacked';
  offset?: UseScrollOptions['offset'];
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset,
  });
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const scaleDimensions = () => {
    return isMobile ? [0.88, 0.96] : [0.94, 1];
  };

  const rotate = useTransform(scrollYProgress, [0, 0.7], isMobile ? [12, 0] : [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.7], scaleDimensions());
  const translate = useTransform(scrollYProgress, [0, 0.7], [0, -30]);

  if (layout === 'stacked') {
    return (
      <div
        className={`h-[60rem] md:h-[80rem] flex items-center justify-center relative p-2 md:p-20 ${className || ''}`}
        ref={containerRef}
      >
        <div
          className="py-10 md:py-40 w-full relative"
          style={{
            perspective: '1000px',
          }}
        >
          <Header translate={translate} titleComponent={titleComponent} />
          <Card
            rotate={rotate}
            translate={translate}
            scale={scale}
            cardClassName={`max-w-5xl -mt-12 mx-auto h-[30rem] md:h-[40rem] ${cardClassName || ''}`}
            innerClassName={innerClassName}
            badgeLeft={badgeLeft}
            badgeRight={badgeRight}
          >
            {children}
          </Card>
        </div>
      </div>
    );
  }

  // Side-by-side layout (PC: Left is Header text, Right is the iPad mockup)
  return (
    <div className={`relative w-full ${className || ''}`} ref={containerRef}>
      <div
        className={`mx-auto grid min-h-[calc(100vh-120px)] max-w-[1440px] items-center gap-12 px-5 sm:px-8 md:grid-cols-[0.92fr_1.08fr] lg:gap-16 lg:px-12 ${containerClassName || ''}`}
        style={{
          perspective: '1200px',
        }}
      >
        {titleComponent && (
          <div className="relative z-10 max-w-2xl">
            {titleComponent}
          </div>
        )}
        <div className="relative mx-auto w-full max-w-[740px] md:ml-auto">
          <Card
            rotate={rotate}
            translate={translate}
            scale={scale}
            cardClassName={cardClassName}
            innerClassName={innerClassName}
            badgeLeft={badgeLeft}
            badgeRight={badgeRight}
          >
            {children}
          </Card>
        </div>
      </div>
    </div>
  );
};

export const Header = ({
  translate,
  titleComponent,
}: {
  translate: MotionValue<number>;
  titleComponent?: React.ReactNode;
}) => {
  return (
    <motion.div
      style={{
        translateY: translate,
      }}
      className="max-w-5xl mx-auto text-center"
    >
      {titleComponent}
    </motion.div>
  );
};

export const Card = ({
  rotate,
  scale,
  children,
  cardClassName,
  innerClassName,
  badgeLeft,
  badgeRight,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  translate?: MotionValue<number>;
  children: React.ReactNode;
  cardClassName?: string;
  innerClassName?: string;
  badgeLeft?: React.ReactNode;
  badgeRight?: React.ReactNode;
}) => {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        boxShadow:
          '0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003',
      }}
      className={`relative w-full border-4 border-[#6C6C6C] p-2 sm:p-3 md:p-3.5 bg-[#222222] rounded-[32px] sm:rounded-[36px] shadow-2xl ${cardClassName || ''}`}
    >
      {badgeLeft}
      <div
        className={`h-full w-full overflow-hidden rounded-[20px] sm:rounded-[24px] bg-[#071914] ${innerClassName || ''}`}
      >
        {children}
      </div>
      {badgeRight}
    </motion.div>
  );
};
