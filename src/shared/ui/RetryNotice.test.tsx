import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { RetryNotice } from './RetryNotice';

describe('RetryNotice', () => {
  test('renders message and retries', () => {
    const onRetry = vi.fn();

    render(<RetryNotice message="Could not load" onRetry={onRetry} />);

    expect(screen.getByText(/Could not load/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
