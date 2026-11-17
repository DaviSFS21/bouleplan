import { Suspense } from 'react';
import {
  InitiativesFallback,
  InitiativesScreen,
} from '@/components/initiatives/initiatives-screen';

export default function Home() {
  return (
    <Suspense fallback={<InitiativesFallback />}>
      <InitiativesScreen />
    </Suspense>
  );
}
