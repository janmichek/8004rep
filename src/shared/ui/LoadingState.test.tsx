import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { LoadingState } from './LoadingState';

describe('LoadingState', () => {
  test('renders the loading label', () => {
    render(<LoadingState label="Loading agents" />);

    expect(screen.getByText('Loading agents')).toBeTruthy();
  });
});
