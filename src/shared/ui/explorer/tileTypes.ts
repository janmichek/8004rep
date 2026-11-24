export type TileMeter =
  | { kind: 'gauge'; value: number | null; band?: [number, number] | null }
  | { kind: 'steps'; filled: number; total: number }
  | { kind: 'severity'; level: number; max: number };

export type Tile = {
  label: string;
  value: string;
  hint?: string | undefined;
  title?: string | undefined;
  tone?: 'main' | 'good' | 'warn' | 'bad' | 'quiet' | undefined;
  word?: boolean | undefined;
  loading?: boolean | undefined;
  meter?: TileMeter | undefined;
};
