/**
 * Runtime-agnostic feedback inputs. The React app, the indexer and the
 * materializer all pass these shapes, so the pure math never imports `viem`.
 */
export type FeedbackResponseInput = {
  responder: string;
  uri?: string;
  /** Unix seconds, when known. */
  createdAt?: number;
  txHash?: string;
};

export type FeedbackInput = {
  client: string;
  /** Feedback index; (client, index) identifies a row per agent. */
  index?: number;
  value: number;
  tag1?: string;
  tag2?: string;
  endpoint?: string;
  revoked: boolean;
  /** Unix seconds; only indexed sources know it. */
  createdAt?: number;
  feedbackURI?: string;
  /** Transaction that left the feedback; log scan only. */
  txHash?: string;
  /** `appendResponse` entries on this row, oldest first. */
  responses?: FeedbackResponseInput[];
};
