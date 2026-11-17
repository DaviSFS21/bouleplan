import { Suspense } from 'react';
import { PlannerFallback, PlannerScreen } from '@/components/planner/planner-screen';

export default function Week() {
  return (
    <Suspense fallback={<PlannerFallback />}>
      <PlannerScreen />
    </Suspense>
  );
}
