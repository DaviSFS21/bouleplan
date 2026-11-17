import type { LucideIcon, LucideProps } from 'lucide-react';

export type IconSize = 14 | 16 | 18 | 20;

type IconProps = Omit<LucideProps, 'size' | 'strokeWidth' | 'nonScalingStroke'> & {
  icon: LucideIcon;
  size?: IconSize;
};

export function Icon({ icon: Glyph, size = 16, ...props }: Readonly<IconProps>) {
  return <Glyph {...props} size={size} strokeWidth={1.5} nonScalingStroke />;
}
