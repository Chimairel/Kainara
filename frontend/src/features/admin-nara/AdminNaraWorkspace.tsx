'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import NaraAnswersWorkspace from './NaraAnswersWorkspace';
import NaraActivityWorkspace from './NaraActivityWorkspace';

export default function AdminNaraWorkspace() {
  return (
    <Tabs defaultValue="answers">
      <TabsList aria-label="Nara management" className="mb-5">
        <TabsTrigger value="answers">Instant answers</TabsTrigger>
        <TabsTrigger value="activity">Submitted messages</TabsTrigger>
      </TabsList>
      <TabsContent value="answers" forceMount className="data-[state=inactive]:hidden">
        <NaraAnswersWorkspace />
      </TabsContent>
      <TabsContent value="activity">
        <NaraActivityWorkspace />
      </TabsContent>
    </Tabs>
  );
}
