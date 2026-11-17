import { Suspense } from 'react';
import {
  IntrospectoFallback,
  IntrospectoScreen,
} from '@/components/introspecto/introspecto-screen';

export default function Introspecto() {
  return (
    <Suspense fallback={<IntrospectoFallback />}>
      <IntrospectoScreen />
    </Suspense>
  );
}
