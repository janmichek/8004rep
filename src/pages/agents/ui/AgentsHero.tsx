import { Search, Sparkle } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';

type Props = {
  chainCount: number;
  initialQuery: string;
  onSearch: (query: string) => void;
};

export function AgentsHero({ chainCount, initialQuery, onSearch }: Props) {
  const [input, setInput] = useState(initialQuery);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSearch(input);
  }

  return (
    <header className="agents-hero">
      <Sparkle className="agents-hero-icon" size={32} aria-hidden="true" />
      <h1>Explore 8004 agents</h1>
      <p className="agents-hero-sub">
        Identity, reputation and validation for trustless agents
        {chainCount > 0 ? ` across ${chainCount} chains` : ''}.
      </p>
      <form className="agents-hero-search" role="search" onSubmit={submit}>
        <label className="agents-hero-field">
          <Search size={18} aria-hidden="true" />
          <input
            key={initialQuery}
            defaultValue={initialQuery}
            onChange={(event) => setInput(event.target.value)}
            type="search"
            placeholder="Search by name or token ID"
            aria-label="Search agents"
          />
        </label>
        <button type="submit">Search</button>
      </form>
    </header>
  );
}
