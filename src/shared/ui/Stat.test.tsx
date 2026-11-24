import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Stat } from './Stat';

describe('Stat', () => {
  test('renders label and value', () => {
    render(<Stat label="Active" value="6" />);

    expect(screen.getByText('Active: 6')).toBeTruthy();
  });
});
