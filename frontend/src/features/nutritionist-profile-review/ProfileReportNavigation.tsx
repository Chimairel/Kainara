'use client';

import { FileText } from 'lucide-react';

import type { useProfileWorkPanelModel } from './useProfileWorkPanelModel';
type Model = Extract<ReturnType<typeof useProfileWorkPanelModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    'detail' | 'setSelection' | 'setDocumentDetail' | 'setFileUrl' | 'selection' | 'openDocument' | 'busy'
  >;
};
export default function ProfileReportNavigation({ model }: SectionProps) {
  const { detail, setSelection, setDocumentDetail, setFileUrl, selection, openDocument, busy } = model;
  if (!detail) return null;
  return (
    <>
      <nav aria-label="Patient guidance and documents" className="space-y-5 text-left">
        <section>
          <h3 className="text-sm font-bold text-brand-text">Nutrition report history</h3>
          <p className="mt-1 text-xs text-brand-muted">Each version uses its saved profile.</p>
          <div className="mt-3 space-y-1">
            {detail.reports.map((report) => (
              <button
                type="button"
                key={report.id}
                onClick={() => {
                  setSelection({ kind: 'report', id: report.id });
                  setDocumentDetail(null);
                  setFileUrl(null);
                }}
                aria-pressed={selection?.id === report.id}
                className={`block w-full rounded-xl px-3 py-2 text-left text-xs ${selection?.id === report.id ? 'bg-brand-bgAlt font-bold text-brand-text' : 'text-brand-muted hover:bg-brand-bgAlt/50'}`}
              >
                Version {report.version} · {new Date(report.generatedAt).toLocaleDateString()}{' '}
                {report.isPlanningReport
                  ? '· Selected for planning'
                  : report.isCurrent
                    ? '· Current profile draft'
                    : ''}
              </button>
            ))}
            {!detail.reports.length && <p className="text-xs text-brand-muted">No guidance prepared yet.</p>}
          </div>
        </section>
        <section>
          <h3 className="text-sm font-bold text-brand-text">Documentation</h3>
          <div className="mt-3 space-y-1">
            {detail.documents.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => void openDocument(item)}
                disabled={busy || item.status === 'WITHDRAWN'}
                aria-pressed={selection?.id === item.id}
                className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-xs ${selection?.id === item.id ? 'bg-brand-bgAlt font-bold text-brand-text' : 'text-brand-muted hover:bg-brand-bgAlt/50'} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 break-all">
                  {item.originalFileName}
                  <small className="block">
                    {item.area.replace(/_/g, ' ')} · {item.pending ? 'Review pending' : item.status.replace(/_/g, ' ')}
                  </small>
                </span>
              </button>
            ))}
            {!detail.documents.length && <p className="text-xs text-brand-muted">No documents uploaded.</p>}
          </div>
        </section>
      </nav>
    </>
  );
}
