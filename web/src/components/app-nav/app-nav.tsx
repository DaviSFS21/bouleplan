'use client';

import { CalendarDays, SquareKanban, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/icon/icon';
import styles from './app-nav.module.css';

interface Section {
  href: string;
  label: string;
  icon: LucideIcon;
}

const SECTIONS: readonly Section[] = [
  { href: '/', label: 'Quadro', icon: SquareKanban },
  { href: '/semana', label: 'Semana', icon: CalendarDays },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <header className={styles.header}>
      <nav aria-label="Seções" className={styles.nav}>
        <div className={styles.links}>
          {SECTIONS.map(({ href, label, icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
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
    </header>
  );
}
