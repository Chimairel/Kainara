'use client';

import { useState } from 'react';
import WorkspaceTabs from '@/components/ui/WorkspaceTabs';
import NaraAnswersWorkspace from './NaraAnswersWorkspace';
import NaraActivityWorkspace from './NaraActivityWorkspace';

export default function AdminNaraWorkspace() {
  const [view, setView] = useState<'answers' | 'activity'>('answers');
  return (
    <div>
      <WorkspaceTabs
        label="Nara management"
        value={view}
        onChange={setView}
        className="mb-5"
        items={[
          { value: 'answers', label: 'Instant answers' },
          { value: 'activity', label: 'Submitted messages' },
        ]}
      />
      <div hidden={view !== 'answers'}>
        <NaraAnswersWorkspace />
      </div>
      {view === 'activity' && <NaraActivityWorkspace />}
    </div>
  );
}
