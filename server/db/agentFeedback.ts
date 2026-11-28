import type { z } from 'zod';
import type { FeedbackInput, FeedbackResponseInput } from '../../shared/reputation';
import type { feedbackRowSchema, responseRowSchema } from './rowSchemas';

type FeedbackRow = z.infer<typeof feedbackRowSchema>;

type ResponseRow = z.infer<typeof responseRowSchema>;

export function toInput(
  parsed: FeedbackRow,
  responses: Map<string, FeedbackResponseInput[]>
): FeedbackInput {
  const key = `${parsed.client_address}|${parsed.feedback_index.toString()}`;

  const input: FeedbackInput = {
    client: parsed.client_address,
    value: parsed.value_scaled,
    revoked: parsed.revoked,
    responses: responses.get(key) ?? [],
  };

  if (parsed.tag1) input.tag1 = parsed.tag1;

  if (parsed.tag2) input.tag2 = parsed.tag2;

  if (parsed.endpoint) input.endpoint = parsed.endpoint;

  if (parsed.feedback_uri) input.feedbackURI = parsed.feedback_uri;
  input.createdAt = Number(parsed.created_at);
  input.txHash = parsed.tx_hash;

  return input;
}

export function responseInputs(rows: readonly ResponseRow[]): Map<string, FeedbackResponseInput[]> {
  const byFeedback = new Map<string, FeedbackResponseInput[]>();

  for (const parsed of rows) {
    const key = `${parsed.client_address}|${parsed.feedback_index.toString()}`;
    const list = byFeedback.get(key) ?? [];
    const input: FeedbackResponseInput = { responder: parsed.responder };

    if (parsed.response_uri) input.uri = parsed.response_uri;
    input.createdAt = Number(parsed.created_at);
    input.txHash = parsed.tx_hash;
    list.push(input);
    byFeedback.set(key, list);
  }

  return byFeedback;
}

/** The exact bytes the content hash covers: inputs, not derived scores. */
export function hashInputs(chainId: number, tokenId: string, feedback: readonly FeedbackInput[]) {
  return {
    chainId,
    tokenId,
    formulaVersion: 'rep-1.0',
    feedback: feedback.map((row) => ({
      client: row.client,
      value: row.value,
      tag1: row.tag1 ?? null,
      tag2: row.tag2 ?? null,
      endpoint: row.endpoint ?? null,
      feedbackURI: row.feedbackURI ?? null,
      revoked: row.revoked,
      createdAt: row.createdAt ?? null,
      txHash: row.txHash ?? null,
      responses: (row.responses ?? []).map((response) => ({
        responder: response.responder,
        uri: response.uri ?? null,
        createdAt: response.createdAt ?? null,
        txHash: response.txHash ?? null,
      })),
    })),
  };
}
