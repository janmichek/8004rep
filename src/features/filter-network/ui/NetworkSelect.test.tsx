import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { NetworkSelect } from './NetworkSelect';
import { renderWithProviders } from '@test/renderWithProviders';

test('shows the selected network with its mark', async () => {
  renderWithProviders(<NetworkSelect value="BASE" onChange={vi.fn()} />);
  const trigger = screen.getByRole('combobox', { name: 'Network' });
  await waitFor(() => expect(trigger.textContent).toContain('Base'));
  await waitFor(() => expect(trigger.textContent).toContain('B'));
});

test('clears the selected network', async () => {
  const onChange = vi.fn();
  renderWithProviders(<NetworkSelect value="BASE" onChange={onChange} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Clear' }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith(undefined);
});

test('picks a network from the list', async () => {
  const onChange = vi.fn();
  renderWithProviders(<NetworkSelect value={undefined} onChange={onChange} />);
  const select = await screen.findByRole('combobox', { name: 'Network' });
  await screen.findByRole('option', { name: 'A Arbitrum (ARB)' });
  fireEvent.change(select, { target: { value: 'ARB' } });
  expect(onChange).toHaveBeenCalledExactlyOnceWith('ARB');
});
