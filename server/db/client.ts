import postgres from 'postgres';

/** Values the stores bind; everything else is serialized to JSON text first. */
export type QueryParam = string | number | bigint | boolean | null | readonly string[];

/** The narrow database surface the stores depend on; fakes implement exactly this. */
export type Sql = {
  query(text: string, params?: readonly QueryParam[]): Promise<object[]>;
  transaction<T>(run: (tx: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

type RawTx = {
  unsafe(query: string, params?: QueryParam[]): Promise<object[]>;
  begin<T>(run: (tx: RawTx) => T | Promise<T>): Promise<T>;
};

type RawSql = RawTx & {
  end(): Promise<void>;
};

type PostgresOptions = {
  max: number;
  prepare: boolean;
  idle_timeout: number;
  connect_timeout: number;
};

export type PostgresFactory = (url: string, options: PostgresOptions) => RawSql;

/** Small pool for serverless functions; a long-lived worker asks for more. */
export const SERVERLESS_POOL = 1;
export const WORKER_POOL = 5;

const OPTIONS = { prepare: false, idle_timeout: 20, connect_timeout: 10 } as const;

function wrap(raw: RawTx, root: RawSql): Sql {
  return {
    query(text: string, params: readonly QueryParam[] = []) {
      return raw.unsafe(text, [...params]);
    },
    transaction<T>(run: (tx: Sql) => Promise<T>) {
      return root.begin(async (tx) => run(wrap(tx, root)));
    },
    close() {
      return root.end();
    },
  };
}

/**
 * Opens a postgres.js pool and adapts it to {@link Sql}. `prepare: false` keeps
 * the driver compatible with transaction-pooling proxies such as Supabase and
 * Neon; every store query is parameterized with `$n` placeholders.
 */
export function createSql(
  databaseUrl: string,
  maxConnections = SERVERLESS_POOL,
  factory: PostgresFactory = (url, options) => postgres(url, options)
): Sql {
  const client = factory(databaseUrl, { ...OPTIONS, max: maxConnections });

  return wrap(client, client);
}
