import { screen, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import { renderWithProviders } from '@test/renderWithProviders';
import { Summary } from './Summary';

test('counts the roster by status and averages scores', async () => {
  renderWithProviders(<Summary network={undefined} />);
  expect((await screen.findByText('Active: 6')).textContent).toBe('Active: 6');
  expect(screen.getByText('Quiet: 4').textContent).toBe('Quiet: 4');
  expect(screen.getByText('Unreviewed: 2').textContent).toBe('Unreviewed: 2');
  expect(screen.getByText('Avg score: 0.61').textContent).toBe('Avg score: 0.61');
});

test('narrows the counts to the picked network', async () => {
  renderWithProviders(<Summary network="ETH" />);
  expect((await screen.findByText('Active: 3')).textContent).toBe('Active: 3');
  expect(screen.getByText('Quiet: 0').textContent).toBe('Quiet: 0');
});

test('shows the server error when agents fail to load', async () => {
  renderWithProviders(<Summary network={undefined} />, 'GET /api/agents');
  await waitFor(() => screen.getByText('Request failed: 500'));
});
