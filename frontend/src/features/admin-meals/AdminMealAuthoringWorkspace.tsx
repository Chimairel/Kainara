'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import AdminMealAuthoring from './AdminMealAuthoring';
import AdminMealBatch from './AdminMealBatch';

export default function AdminMealAuthoringWorkspace({ active }: { active: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const mode = params.get('tab') === 'batch' || params.get('mode') === 'batch' ? 'batch' : 'single';
  const [visited, setVisited] = useState(() => new Set([mode]));
  useEffect(() => {
    setVisited((previous) => new Set([...previous, mode]));
  }, [mode]);
  return (
    <Tabs
      value={mode}
      activationMode="manual"
      onValueChange={(value) => {
        const next = new URLSearchParams(params.toString());
        next.set('tab', 'author');
        if (value === 'batch') next.set('mode', 'batch');
        else next.delete('mode');
        router.replace(`${pathname}?${next}`, { scroll: false });
      }}
    >
      <TabsList aria-label="Meal authoring method" className="sm:max-w-md">
        <TabsTrigger value="single" className="flex-1">
          Single meal
        </TabsTrigger>
        <TabsTrigger value="batch" className="flex-1">
          Batch JSON
        </TabsTrigger>
      </TabsList>
      {(['single', 'batch'] as const)
        .filter((value) => visited.has(value) || mode === value)
        .map((value) => (
          <TabsContent
            key={value}
            value={value}
            forceMount
            hidden={mode !== value}
            style={mode !== value ? { display: 'none' } : undefined}
          >
            {value === 'single' ? (
              <AdminMealAuthoring active={active && mode === value} />
            ) : (
              <AdminMealBatch active={active && mode === value} />
            )}
          </TabsContent>
        ))}
    </Tabs>
  );
}
