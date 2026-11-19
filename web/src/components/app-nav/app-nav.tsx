'use client';

import { CalendarDays, Notebook, SquareKanban, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/icon/icon';
import styles from './app-nav.module.css';

interface Section {
  href: string;
  label: string;
  icon: LucideIcon;
}

const BOARD: Section = { href: '/', label: 'Quadro', icon: SquareKanban };

const SECTIONS: readonly Section[] = [
  BOARD,
  { href: '/semana', label: 'Semana', icon: CalendarDays },
  { href: '/introspecto', label: 'Introspecto', icon: Notebook },
];

export function isActive(href: string, pathname: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

// The section the path belongs to; the board is the fallback.
export function sectionOf(pathname: string): Section {
  return SECTIONS.find(({ href }) => href !== '/' && isActive(href, pathname)) ?? BOARD;
}

interface AppNavProps {
  // The links inside the header, or the bar fixed at the bottom of a phone.
  placement?: 'top' | 'bottom';
}

export function AppNav({ placement = 'top' }: Readonly<AppNavProps>) {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções" className={placement === 'top' ? undefined : styles.bar}>
      <div className={styles.links}>
        {SECTIONS.map(({ href, label, icon }) => {
          const active = isActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={styles.item}
            >
              <Icon icon={icon} size={18} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
