import { render } from '@testing-library/react';
import { Plus } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { Icon } from './icon';

function svgOf(container: HTMLElement): SVGElement {
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('svg not rendered');
  return svg;
}

describe('Icon', () => {
  it('renders 16px by default and is hidden from assistive technology', () => {
    const svg = svgOf(render(<Icon icon={Plus} />).container);

    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('height', '16');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it.each([14, 16, 18, 20] as const)('keeps a 1.5px non-scaling stroke at %ipx', (size) => {
    const svg = svgOf(render(<Icon icon={Plus} size={size} />).container);

    expect(svg).toHaveAttribute('width', String(size));
    expect(svg).toHaveAttribute('stroke-width', '1.5');
    expect(svg.querySelector('path')).toHaveAttribute('vector-effect', 'non-scaling-stroke');
  });

  it('rejects other sizes and stroke overrides at compile time', () => {
    // @ts-expect-error size is restricted to the design system scale
    render(<Icon icon={Plus} size={24} />);
    // @ts-expect-error the stroke width is fixed by the design system
    render(<Icon icon={Plus} strokeWidth={3} />);
  });
});
