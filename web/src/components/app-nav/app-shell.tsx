'use client';

import type { ReactNode } from 'react';
import { useIsPhone } from '@/components/responsive/use-media-query';
import { AppHeader, PhoneTopBar } from './app-header';
import { AppNav } from './app-nav';

// The phone's bottom bar comes after the page in the DOM, so it is not the first tab stop.
export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const phone = useIsPhone();
  return (
    <>
      {phone ? <PhoneTopBar /> : <AppHeader />}
      {children}
      {phone ? <AppNav placement="bottom" /> : null}
    </>
  );
}
