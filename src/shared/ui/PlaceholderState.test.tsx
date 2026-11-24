import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { PlaceholderState } from './PlaceholderState';

describe('PlaceholderState', () => {
  test('renders the title and default note', () => {
    render(<PlaceholderState title="Docs" />);

    expect(screen.getByRole('heading', { name: 'Docs' })).toBeTruthy();
    expect(screen.getByText(/Porting the classic explorer/)).toBeTruthy();
  });

  test('renders a custom note', () => {
    render(<PlaceholderState title="Docs" note="Coming soon" />);

    expect(screen.getByText('Coming soon')).toBeTruthy();
  });
});
