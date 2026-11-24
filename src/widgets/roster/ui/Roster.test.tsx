import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { renderWithProviders } from '@test/renderWithProviders';
import { Roster } from './Roster';

test('lists the newest agents first, up to the limit', async () => {
  renderWithProviders(
    <Roster network={undefined} limit={2} expandedId={undefined} onToggle={() => {}} />
  );
  const rows = await screen.findAllByRole('button', { name: /^Show detail/ });
  expect(rows.map((row) => row.textContent)).toEqual(['Show detail 12', 'Show detail 11']);
});

test('opens a row through the toggle callback', async () => {
  const onToggle = vi.fn();
  renderWithProviders(
    <Roster network={undefined} limit={1} expandedId={undefined} onToggle={onToggle} />
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Show detail 12' }));
  expect(onToggle).toHaveBeenCalledExactlyOnceWith(12);
});

test('explains an empty result instead of rendering an empty table', async () => {
  renderWithProviders(
    <Roster network="NOPE" limit={undefined} expandedId={undefined} onToggle={() => {}} />
  );
  expect(await screen.findByText('No agents match this network.')).toBeDefined();
});

test('renders the expanded facts', async () => {
  renderWithProviders(
    <Roster network="ETH" limit={undefined} expandedId={3} onToggle={() => {}} />
  );
  expect((await screen.findByText('Ledger Mint')).textContent).toBe('Ledger Mint');
  expect(screen.getByText('0x3333333333333333333333333333333333333333').textContent).toBe(
    '0x3333333333333333333333333333333333333333'
  );
});

test('shows the server error when agents fail to load', async () => {
  renderWithProviders(
    <Roster network={undefined} limit={undefined} expandedId={undefined} onToggle={() => {}} />,
    'GET /api/agents'
  );
  await waitFor(() => screen.getByText('Request failed: 500'));
});
