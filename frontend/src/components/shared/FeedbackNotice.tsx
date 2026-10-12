import type { HTMLAttributes, ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import styles from './FeedbackNotice.module.css';

type FeedbackTone = 'error' | 'warning' | 'info' | 'success';

export interface FeedbackNoticeProps extends HTMLAttributes<HTMLDivElement> {
  tone?: FeedbackTone;
  variant?: 'surface' | 'inline';
  title?: string;
  children: ReactNode;
}

/** Keep the failure, recovery action and validation ownership in the calling feature. */
export default function FeedbackNotice({
  tone = 'error',
  variant = 'surface',
  title,
  children,
  className = '',
  role,
  ...props
}: FeedbackNoticeProps) {
  const Icon = tone === 'success' ? CircleCheck : tone === 'info' ? Info : CircleAlert;
  return (
    <div
      {...props}
      role={role ?? (tone === 'error' ? 'alert' : 'status')}
      aria-atomic="true"
      data-feedback-tone={tone}
      className={`${styles.notice} ${variant === 'inline' ? styles.inline : styles.surface} ${className}`}
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon className="h-4 w-4" />
      </span>
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        {children}
      </div>
    </div>
  );
}
