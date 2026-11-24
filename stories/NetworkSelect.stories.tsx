import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { NetworkSelect } from '../src/features/filter-network';

const meta = {
  component: NetworkSelect,
  args: { value: undefined, onChange: () => {} },
  // the select is controlled, so the story holds the picked value
  render: function Render(args) {
    const [value, setValue] = useState(args.value);

    return <NetworkSelect {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof NetworkSelect>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Preselected: Story = {
  args: { value: 'BASE' },
};

export const Disabled: Story = {
  args: { value: 'ARB', disabled: true },
};
