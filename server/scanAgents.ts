import { z } from 'zod';
import { agentPageSchema, type Agent, type AgentPage, type AgentsQuery } from '../shared/schemas';

/**
 * The list proxy's upstream: 8004scan's public API. It is CORS-open and
 * keyless, but the browser should not be the one spending its rate limit.
 */
const SCAN_API = 'https://8004scan.io/api/v1/public/agents';
const TIMEOUT_MS = 10_000;
const DEFAULT_PAGE_SIZE = 25;

const SORT_BY = {
  registered: 'created_at',
  score: 'total_score',
  feedback: 'total_feedbacks',
} as const;

/** The slice of one 8004scan row the list needs; unknown fields are ignored. */
const scanAgentRowSchema = z.object({
  chain_id: z.number().int(),
  token_id: z.union([
    z.string().regex(/^\d+$/),
    z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  ]),
  owner_address: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  supported_protocols: z.array(z.string()).nullable().optional(),
  x402_supported: z.boolean().nullable().optional(),
  total_score: z.number().nullable().optional(),
  average_score: z.number().nullable().optional(),
  total_feedbacks: z.number().nullable().optional(),
  is_testnet: z.boolean().nullable().optional(),
  created_at: z.string().nullable().optional(),
});

const scanPageSchema = z.object({
  success: z.literal(true),
  data: z.array(z.unknown()),
  meta: z
    .object({
      pagination: z
        .object({
          total: z.number().nullable().optional(),
          hasMore: z.boolean().nullable().optional(),
        })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
});

type ScanAgentRow = z.infer<typeof scanAgentRowSchema>;

type ScanPage = z.infer<typeof scanPageSchema>;

/** An upstream failure the route can map back to a status and Retry-After header. */
export class ScanUpstreamError extends Error {
  readonly status: number;
  readonly retryAfter: string | undefined;

  constructor(message: string, status: number, retryAfter?: string) {
    super(message);
    this.name = 'ScanUpstreamError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function addText(agent: Agent, key: 'name' | 'description' | 'imageUrl', value?: string | null) {
  if (value) agent[key] = value;
}

/** Maps a parsed upstream row to the wire contract. */
export function toAgent(row: ScanAgentRow): Agent {
  const created = row.created_at ? Date.parse(row.created_at) : Number.NaN;
  const tokenId = String(row.token_id);

  const agent: Agent = {
    chainId: row.chain_id,
    tokenId,
    owner: row.owner_address ?? null,
    protocols: row.supported_protocols ?? [],
    x402: row.x402_supported === true,
    totalScore: row.total_score ?? 0,
    averageScore: row.average_score ?? 0,
    feedbackCount: row.total_feedbacks ?? 0,
    testnet: row.is_testnet === true,
  };

  addText(agent, 'name', row.name);

  addText(agent, 'description', row.description);

  addText(agent, 'imageUrl', row.image_url);

  if (Number.isFinite(created)) agent.createdAt = Math.floor(created / 1000);

  return agent;
}

/** Reads a parsed 8004scan envelope; malformed rows are skipped. */
export function parseAgentPage(body: ScanPage): AgentPage {
  const items = body.data.flatMap((row) => {
    const parsed = scanAgentRowSchema.safeParse(row);

    return parsed.success ? [toAgent(parsed.data)] : [];
  });

  const pagination = body.meta?.pagination;

  return {
    items,
    total: pagination?.total ?? items.length,
    hasMore: pagination?.hasMore === true,
  };
}

/** Keep only a seconds value; an HTTP-date is valid upstream but not worth re-parsing here. */
function readRetryAfter(response: Response): string | undefined {
  const value = response.headers.get('retry-after')?.trim();

  return value !== undefined && /^\d{1,6}$/.test(value) ? value : undefined;
}

/** Sorted, paginated agents from 8004scan, validated against the shared contract. */
export async function fetchAgentPage(query: AgentsQuery): Promise<AgentPage> {
  const params = new URLSearchParams({
    page: String((query.page ?? 0) + 1),
    limit: String(query.pageSize ?? DEFAULT_PAGE_SIZE),
    sortBy: SORT_BY[query.sort ?? 'registered'],
    sortOrder: query.order ?? 'desc',
  });

  if (query.q) params.set('search', query.q);

  if (query.chain !== undefined) params.set('chainId', String(query.chain));

  if (query.env) params.set('isTestnet', String(query.env === 'testnet'));

  const response = await fetch(`${SCAN_API}?${params.toString()}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new ScanUpstreamError(
      `8004scan answered ${response.status}`,
      response.status,
      readRetryAfter(response)
    );
  }

  const parsed = scanPageSchema.safeParse(await response.json().catch(() => null));

  if (!parsed.success) throw new Error('8004scan returned an unexpected agent list');

  return agentPageSchema.parse(parseAgentPage(parsed.data));
}
