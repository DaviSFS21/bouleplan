import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { TabStrip, tabPanelProps } from './tab-strip';

const ITEMS = [
  { id: 'a', label: 'Primeira', content: 'Primeira' },
  { id: 'b', label: 'Segunda', content: 'Segunda' },
  { id: 'c', label: 'Terceira', content: 'Terceira' },
];

function Harness() {
  const [selected, setSelected] = useState('a');
  return (
    <>
      <TabStrip
        label="Etapas"
        prefix="etapas"
        items={ITEMS}
        selectedId={selected}
        onSelect={setSelected}
      />
      <div {...tabPanelProps('etapas', selected)}>{`Painel ${selected}`}</div>
    </>
  );
}

describe('TabStrip', () => {
  it('renders a tablist whose selected tab owns the tabpanel', () => {
    render(<Harness />);

    const tabs = screen.getAllByRole('tab');
    expect(screen.getByRole('tablist', { name: 'Etapas' })).toBeInTheDocument();
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    const panel = screen.getByRole('tabpanel', { name: 'Primeira' });
    expect(tabs[0]).toHaveAttribute('aria-controls', panel.id);
  });

  it('selects a tab on click', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('tab', { name: 'Segunda' }));

    expect(screen.getByRole('tabpanel', { name: 'Segunda' })).toHaveTextContent('Painel b');
  });

  it('moves with the arrow keys, wrapping at both ends, and focuses the new tab', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole('tab', { name: 'Primeira' }).focus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Segunda' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Segunda' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Terceira' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Primeira' })).toHaveFocus();
  });

  it('jumps with Home and End and ignores other keys', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole('tab', { name: 'Primeira' }).focus();

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Terceira' })).toHaveFocus();

    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Primeira' })).toHaveFocus();

    await user.keyboard('x');
    expect(screen.getByRole('tab', { name: 'Primeira' })).toHaveAttribute('aria-selected', 'true');
  });
});
