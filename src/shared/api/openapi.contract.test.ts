import { expect, test } from 'vitest';
import type { AgentPage, Network } from '@shared/schemas';
import type { operations } from './schema';

/* oxlint-disable typescript/no-unnecessary-type-parameters -- equality probe uses the parameter once, by position */
type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;
/* oxlint-enable typescript/no-unnecessary-type-parameters */

type Expect<T extends true> = T;

type ExpectFalse<T extends false> = T;

/** Drops the `| undefined` that Zod adds to optional properties; the wire omits them instead. */
type Wire<T> = T extends readonly (infer Item)[]
  ? Wire<Item>[]
  : T extends object
    ? { [Key in keyof T]: Wire<Exclude<T[Key], undefined>> }
    : T;

type Json200<Operation> = Operation extends {
  responses: { 200: { content: { 'application/json': infer Body } } };
}
  ? Body
  : never;

const agentsMatch: Expect<Equal<Json200<operations['listAgents']>, Wire<AgentPage>>> = true;
const networksMatch: Expect<Equal<Json200<operations['listNetworks']>, Network[]>> = true;

const stringIsNotNumber: ExpectFalse<Equal<string, number>> = false;

test('generated OpenAPI types match the Zod schemas', () => {
  expect(agentsMatch).toBe(true);
  expect(networksMatch).toBe(true);
  expect(stringIsNotNumber).toBe(false);
});
