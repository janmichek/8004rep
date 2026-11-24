import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { AddressEntityHead } from './AddressEntityHead';

describe('AddressEntityHead', () => {
  test('renders address role and accepts star click', () => {
    render(
      <AddressEntityHead
        address="0x1234567890abcdef1234567890abcdef12345678"
        chainId={8453}
        chainName="Base"
        kind="owner"
        roleLabel="Owner"
      />
    );

    expect(screen.getByText('0x1234…5678')).toBeTruthy();
    expect(screen.getByText(/Owner on Base/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Star/ }));
    expect(screen.getByRole('button', { name: /Star/ })).toBeTruthy();
  });
});
