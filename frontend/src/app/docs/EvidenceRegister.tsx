import { ArrowUpRight } from 'lucide-react';
import {
  CLINICAL_POLICY_SUMMARIES,
  EVIDENCE_CATEGORY_LABELS,
  EVIDENCE_SOURCES,
  EVIDENCE_STATUS_LABELS,
  type EvidenceSourceCategory,
} from '@/data/evidence-sources';
import type { DocsSection } from './DocsChapters';

const categories = Object.keys(EVIDENCE_CATEGORY_LABELS) as EvidenceSourceCategory[];

const originalLink =
  'inline-flex items-center gap-1.5 font-semibold text-brand-green underline decoration-brand-green/40 underline-offset-2 hover:text-brand-greenHover';

export const evidenceRegisterSections: DocsSection[] = [
  {
    id: 'data-sources-policy-map',
    title: 'Background guidance and inactive policies',
    content: (
      <>
        <p>
          These reference entries describe proposed calculations and where professional judgment would be required. They
          are reference material, not a list of active app features. They are{' '}
          <strong className="text-brand-text">inactive drafts</strong> until the exact policy version, inputs,
          population, and failure behavior receive the required Registered Nutritionist-Dietitian approvals. A published
          reference does not activate a clinical rule on its own.
        </p>
        <div className="space-y-9 pt-2">
          {CLINICAL_POLICY_SUMMARIES.map((policy) => {
            const sources = policy.evidenceSourceIds
              .map((sourceId) => EVIDENCE_SOURCES.find((source) => source.id === sourceId))
              .filter((source): source is NonNullable<typeof source> => Boolean(source));
            return (
              <div key={policy.id} className="border-t border-brand-border/70 pt-7">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h4 className="font-display text-lg font-bold text-brand-text">{policy.label}</h4>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    Inactive draft
                  </span>
                </div>
                <p className="mt-3">{policy.explanation}</p>
                <p className="mt-4 font-semibold text-brand-text">What can be calculated</p>
                <ul className="list-disc space-y-1 pl-5">
                  {policy.deterministicUse.map((use) => (
                    <li key={use}>{use}</li>
                  ))}
                </ul>
                {policy.calculation && (
                  <p>
                    <span className="font-semibold text-brand-text">Proposed calculation:</span> {policy.calculation}
                  </p>
                )}
                <p>
                  <span className="font-semibold text-brand-text">Review boundary:</span> {policy.reviewBoundary}
                </p>
                <p className="text-xs">
                  Supporting sources:{' '}
                  {sources.map((source, index) => (
                    <span key={source.id}>
                      {index > 0 && ', '}
                      <a href={source.href} target="_blank" rel="noopener noreferrer" className={originalLink}>
                        {source.shortName}
                        <ArrowUpRight className="h-3 w-3" />
                      </a>
                    </span>
                  ))}
                </p>
              </div>
            );
          })}
        </div>
      </>
    ),
  },
  ...categories.map((category): DocsSection => {
    const sources = EVIDENCE_SOURCES.filter((source) => source.category === category);
    return {
      id: `data-sources-${category.toLowerCase().replaceAll('_', '-')}`,
      title: EVIDENCE_CATEGORY_LABELS[category],
      content: (
        <>
          <p>
            Each entry states what the source contributes and how far its authority reaches in KAINARA. The status
            beside it distinguishes current system use from an inactive policy draft or recipe provenance alone.
          </p>
          <div className="space-y-8 pt-2">
            {sources.map((source) => (
              <div key={source.id} className="border-t border-brand-border/70 pt-7">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h4 className="font-display text-lg font-bold text-brand-text">{source.name}</h4>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-green">
                    {source.shortName}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-brand-muted">{EVIDENCE_STATUS_LABELS[source.status]}</p>
                <p className="mt-3">{source.role}</p>
                {(source.sourceVersion || source.locator || source.population || source.limitation) && (
                  <dl className="mt-4 space-y-2 text-xs leading-6">
                    {source.sourceVersion && (
                      <div>
                        <dt className="inline font-semibold text-brand-text">Version: </dt>
                        <dd className="inline">{source.sourceVersion}</dd>
                      </div>
                    )}
                    {source.locator && (
                      <div>
                        <dt className="inline font-semibold text-brand-text">Exact support: </dt>
                        <dd className="inline">{source.locator}</dd>
                      </div>
                    )}
                    {source.population && (
                      <div>
                        <dt className="inline font-semibold text-brand-text">Population: </dt>
                        <dd className="inline">{source.population}</dd>
                      </div>
                    )}
                    {source.limitation && (
                      <div>
                        <dt className="inline font-semibold text-brand-text">Limit: </dt>
                        <dd className="inline">{source.limitation}</dd>
                      </div>
                    )}
                  </dl>
                )}
                <a
                  href={source.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${originalLink} mt-4 text-xs`}
                >
                  Open original source <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
            ))}
          </div>
        </>
      ),
    };
  }),
  {
    id: 'data-sources-statuses',
    title: 'How to read source statuses',
    content: (
      <>
        <p>
          <strong className="text-brand-text">Used in system</strong> means the data or calculation method is currently
          integrated. Availability depends on the configured data release and whether the ingredient has a supported
          match. It does not mean every recipe has measured nutrition or every possible clinical use of that source is
          active.
        </p>
        <p>
          <strong className="text-brand-text">Draft policy</strong> means a source informs an inactive rule that still
          needs the configured RND approvals for its exact calculation and scope.{' '}
          <strong className="text-brand-text">Provenance only</strong> identifies the origin of a recipe and grants no
          nutrition or safety authority.
        </p>
        <p>
          Citing an organization does not mean that it sponsors, endorses, clinically approves, or formally cooperates
          with KAINARA. The link lets readers inspect the published source and its stated limits.
        </p>
      </>
    ),
  },
];
