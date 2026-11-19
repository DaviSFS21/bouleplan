'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppNav, sectionOf } from './app-nav';
import styles from './app-header.module.css';

const LOCKUP = { width: 160, height: 32 } as const;

export function AppHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" aria-label="Bouléplan" className={styles.brand}>
        <Image
          src="/brand/bouleplan-lockup-horizontal-small.svg"
          alt=""
          unoptimized
          className={styles.light}
          {...LOCKUP}
        />
        <Image
          src="/brand/bouleplan-lockup-horizontal-small-grafite.svg"
          alt=""
          unoptimized
          className={styles.dark}
          {...LOCKUP}
        />
      </Link>
      <AppNav placement="top" />
      <div className={styles.account} data-slot="account" />
    </header>
  );
}

export function PhoneTopBar() {
  const section = sectionOf(usePathname());
  return (
    <header className={styles.topBar}>
      <Image
        src="/brand/bouleplan-mark-small.svg"
        alt=""
        unoptimized
        width={24}
        height={24}
        className={styles.light}
      />
      <Image
        src="/brand/bouleplan-mark-small-grafite.svg"
        alt=""
        unoptimized
        width={24}
        height={24}
        className={styles.dark}
      />
      <p className={styles.section}>{section.label}</p>
    </header>
  );
}
