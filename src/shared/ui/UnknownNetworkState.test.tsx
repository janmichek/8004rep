import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { UnknownNetworkState } from './UnknownNetworkState';

describe('UnknownNetworkState', () => {
  test('renders unknown network heading', () => {
    render(<UnknownNetworkState />);

    expect(screen.getByRole('heading', { name: 'Unknown network' })).toBeTruthy();
  });
});
