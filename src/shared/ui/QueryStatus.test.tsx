import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { QueryStatus } from './QueryStatus';

describe('QueryStatus', () => {
  test('renders loading label', () => {
    render(<QueryStatus loading empty={false} loadingLabel="Loading…" emptyLabel="Empty" />);

    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  test('renders empty label', () => {
    render(<QueryStatus loading={false} empty loadingLabel="Loading…" emptyLabel="Empty" />);

    expect(screen.getByText('Empty')).toBeTruthy();
  });

  test('renders nothing when settled with rows', () => {
    const { container } = render(
      <QueryStatus loading={false} empty={false} loadingLabel="Loading…" emptyLabel="Empty" />
    );

    expect(container.textContent).toBe('');
  });
});
