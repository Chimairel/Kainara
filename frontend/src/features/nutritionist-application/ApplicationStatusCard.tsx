import { CalendarClock, Check, AlertCircle, Sparkles, ExternalLink } from 'lucide-react';
import { applicationStatusLabels, applicationStatusOrder, type PublicApplication } from './model';

export function ApplicationStatusCard({ application }: { application: PublicApplication }) {
  const activeIndex = applicationStatusOrder.indexOf(application.status);

  return (
    <div className="surface-panel relative overflow-hidden rounded-[30px] p-6 sm:p-9 shadow-xl border border-brand-border">
      {/* Header with Applicant info & Reference pill */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-brand-border/60 pb-6">
        <div className="flex items-center gap-4">
          {application.officialHeadshot ? (
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border-2 border-emerald-500/40 shadow">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={application.officialHeadshot}
                alt={application.fullName}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold">
              RND
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-400">
                Application record
              </p>
            </div>
            <h2 className="mt-1 font-display text-2xl font-black text-brand-text">
              {applicationStatusLabels[application.status]}
            </h2>
            <p className="mt-0.5 text-xs text-brand-muted">
              {application.fullName} · {application.email}
            </p>
          </div>
        </div>

        <div className="flex sm:flex-col items-start sm:items-end justify-between gap-1">
          <span className="text-[10px] font-medium text-brand-muted">Reference</span>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 font-mono text-xs font-bold text-emerald-400">
            {application.referenceCode}
          </span>
        </div>
      </div>

      {application.status === 'REJECTED' ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-status-error-text/30 bg-status-error-bg/15 p-4 text-xs font-semibold text-status-error-text">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="leading-5">
            {application.decisionReason ||
              'The administrator recorded a final decision. Contact KAINARA if you need clarification.'}
          </div>
        </div>
      ) : (
        /* Status Progression Stepper */
        <div className="mt-8">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-muted mb-4">
            Application Progress
          </p>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-6">
            {applicationStatusOrder.map((status, index) => {
              const reached = activeIndex >= index;
              const isCurrent = activeIndex === index;

              return (
                <div key={status} className="flex flex-col items-center text-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition-all ${
                      reached
                        ? isCurrent
                          ? 'border-brand-accent bg-brand-accent text-white shadow-lg shadow-brand-accent/25 ring-4 ring-brand-accent/20'
                          : 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                        : 'border-brand-border bg-brand-surface/60 text-brand-muted'
                    }`}
                  >
                    {reached && !isCurrent ? (
                      <Check className="h-4 w-4 stroke-[3]" />
                    ) : (
                      <span className="font-mono text-xs font-bold">{index + 1}</span>
                    )}
                  </div>
                  <p
                    className={`mt-2 text-[10px] font-bold leading-tight ${
                      isCurrent ? 'text-brand-accent' : reached ? 'text-brand-text' : 'text-brand-muted/70'
                    }`}
                  >
                    {applicationStatusLabels[status]}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {application.status === 'CALL_SCHEDULED' && application.scheduledCallAt && (
        <div className="mt-7 rounded-2xl border border-brand-cyan/30 bg-brand-cyan/[0.08] p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-brand-text">
            <CalendarClock className="h-4 w-4 text-brand-cyan" />
            Verification Call Scheduled
          </div>
          <p className="mt-2 text-base font-extrabold text-brand-text">
            {new Date(application.scheduledCallAt).toLocaleString('en-US', {
              dateStyle: 'full',
              timeStyle: 'short',
            })}
          </p>
          <p className="mt-1 text-xs text-brand-muted">
            Have your physical PRC ID card ready for camera presentation during the 15-minute call.
          </p>
          {application.meetingUrl && (
            <a
              href={application.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-cyan px-4 py-2 text-xs font-bold text-[#071914] shadow hover:brightness-110 transition"
            >
              Open Google Meet Link
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}

      {application.status === 'APPROVED' && (
        <div className="mt-7 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
            <Sparkles className="h-4 w-4" />
            Application Approved
          </div>
          <p className="mt-2 text-xs leading-5 text-brand-muted">
            {application.invitationSentAt
              ? 'Check your email inbox for your private nutritionist workspace activation link. It remains valid for 72 hours.'
              : 'Your application is approved. Workspace invitation delivery is currently processing.'}
          </p>
        </div>
      )}
    </div>
  );
}
