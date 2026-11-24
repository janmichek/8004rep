import { toDisplayUrl } from '../../lib/explorer/data/metadata';

export function evidenceUrl(uri: string | undefined): string | undefined {
  return uri && !/^data:/i.test(uri) ? toDisplayUrl(uri) : undefined;
}
