import Image from 'next/image';
import styles from './NaraPresenter.module.css';

/** One aligned illustration: body behind the screen, hands in its moving foreground. */
export default function NaraPresenter({ layer }: { layer: 'body' | 'hands' }) {
  return (
    <div className={styles.layer} aria-hidden="true" data-nara-presenter={layer}>
      <svg width="0" height="0" aria-hidden="true">
        <defs>
          <filter id={`nara-${layer}-alpha`} colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncA type="linear" slope="3" intercept="-2" />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>
      <Image
        src={layer === 'body' ? '/mascots/nara-presenter-body.webp' : '/mascots/nara-presenter-hands.webp'}
        alt=""
        width={1536}
        height={1024}
        priority
        sizes="(min-width: 1280px) 1536px, 150vw"
        className={`${styles.artwork} ${layer === 'body' ? styles.body : styles.hands}`}
      />
    </div>
  );
}
