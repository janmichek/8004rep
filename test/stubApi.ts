import { vi } from 'vitest';
import { networks } from '../server/data';
import type { AgentPage, Network } from '../shared/schemas';

const agentPage: AgentPage = {
  items: [
    {
      chainId: 8453,
      tokenId: '1',
      name: 'Atlas Broker',
      owner: '0x1111111111111111111111111111111111111111',
      protocols: ['MCP'],
      x402: false,
      totalScore: 72,
      averageScore: 80,
      feedbackCount: 18,
      createdAt: 1_736_154_840,
      testnet: false,
    },
  ],
  total: 1,
  hasMore: false,
};

const routes = new Map<string, AgentPage | Network[]>([
  ['GET /api/agents', agentPage],
  ['GET /api/networks', networks],
]);

// fetch stub serving the server fixtures; unknown URLs 404 so a typo fails the test.
// Restored after each test by `unstubGlobals` in config/vite.config.ts.
// openapi-fetch calls fetch with a Request, so method and path are read off that.
export function stubApi(failedPath?: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname;
      const route = `${request.method} ${path}`;

      if (route === failedPath) return new Response(null, { status: 500 });

      const body = routes.get(route);

      return body === undefined ? new Response(null, { status: 404 }) : Response.json(body);
    })
  );
}
