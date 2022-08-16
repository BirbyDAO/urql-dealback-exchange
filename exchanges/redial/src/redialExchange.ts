import {
  debounce,
  filter,
  fromValue,
  makeSubject,
  merge,
  mergeMap,
  pipe,
  share,
  Source,
  takeUntil,
} from 'wonka';

import {
  Exchange,
  makeOperation,
  Operation,
  OperationResult,
} from '@urql/core';
import { Kind } from 'graphql/language';
import { createFromPath } from './getter';

export interface RedialExchangeOptions {
  initialDelayMs?: number;
  maxDelayMs?: number;
  randomDelay?: boolean;
  maxNumberAttempts?: number;
  retryUntilPatternSucceeds: Record<string, string | string[]>;
}

export const redialExchange = ({
  initialDelayMs,
  maxDelayMs,
  randomDelay,
  maxNumberAttempts,
  retryUntilPatternSucceeds,
}: RedialExchangeOptions): Exchange => {
  const MIN_DELAY = initialDelayMs || 1000;
  const MAX_DELAY = maxDelayMs || 15000;
  const MAX_ATTEMPTS = maxNumberAttempts || 100;
  const RANDOM_DELAY = randomDelay || true;

  const queryEntries = Object.entries(retryUntilPatternSucceeds).map(
    ([queryName, ruleOrRules]) => {
      const rules =
        typeof ruleOrRules === 'string' ? [ruleOrRules] : ruleOrRules;

      rules.forEach((rule, i) => {
        if (!rule.startsWith('$.'))
          throw new Error(
            `Redial matcher of query "${queryName}"[${i}] should have leading root selector "$." but non were given: ${rule}`
          );
      });

      const matchers = rules.map(path => {
        const getter = createFromPath(path);
        return (obj: object) => {
          const val = getter(obj);
          return !!val;
        };
      });

      return [
        queryName as string,
        (obj: object) => matchers.every(match => match(obj)),
      ] as const;
    }
  );

  const QUERY_SUCCEEDED = new Map<string, (obj: object) => boolean>(
    queryEntries
  );

  return ({ forward, dispatchDebug }) => ops$ => {
    const sharedOps$ = pipe(ops$, share);
    const {
      source: retry$,
      next: nextRetryOperation,
    } = makeSubject<Operation>();

    const retryWithBackoff$ = pipe(
      retry$,
      mergeMap((op: Operation) => {
        const { key, context } = op;
        const retryCount = (context.retryCount || 0) + 1;
        let delayAmount = context.retryDelay || MIN_DELAY;

        const backoffFactor = Math.random() + 1.5;
        // if randomDelay is enabled and it won't exceed the max delay, apply a random
        // amount to the delay to avoid thundering herd problem
        if (RANDOM_DELAY && delayAmount * backoffFactor < MAX_DELAY) {
          delayAmount *= backoffFactor;
        }

        // We stop the retries if a teardown event for this operation comes in
        // But if this event comes through regularly we also stop the retries, since it's
        // basically the query retrying itself, no backoff should be added!
        const teardown$ = pipe(
          sharedOps$,
          filter(op => {
            return (
              (op.kind === 'query' || op.kind === 'teardown') && op.key === key
            );
          })
        );

        dispatchDebug({
          type: 'retryAttempt',
          message: `The operation has failed and a retry has been triggered (${retryCount} / ${MAX_ATTEMPTS})`,
          operation: op,
          data: {
            retryCount,
          },
        });

        // Add new retryDelay and retryCount to operation
        return pipe(
          fromValue(
            makeOperation(op.kind, op, {
              ...op.context,
              retryDelay: delayAmount,
              retryCount,
            })
          ),
          debounce(() => delayAmount),
          // Stop retry if a teardown comes in
          takeUntil(teardown$)
        );
      })
    );

    const result$ = pipe(
      merge([sharedOps$, retryWithBackoff$]),
      forward,
      share,
      filter(res => {
        // Only retry if the error passes the conditional retryIf function (if passed)
        // or if the error contains a networkError
        const query = res.operation.query.definitions[0];

        if (
          res.error ||
          query.kind !== Kind.OPERATION_DEFINITION ||
          !query.name ||
          !QUERY_SUCCEEDED.has(query.name.value)
        ) {
          return true;
        }

        const isAllMatched = QUERY_SUCCEEDED.get(query.name.value)!(res.data);
        const maxNumberAttemptsExceeded =
          (res.operation.context.retryCount || 0) >= MAX_ATTEMPTS - 1;

        if (!maxNumberAttemptsExceeded && !isAllMatched) {
          // Send failed responses to be retried by calling next on the retry$ subject
          // Exclude operations that have been retried more than the specified max
          nextRetryOperation(res.operation);
          return false;
        }

        if (maxNumberAttemptsExceeded)
          dispatchDebug({
            type: 'retryExhausted',
            message:
              'Maximum number of retries has been reached. No further retries will be performed.',
            operation: res.operation,
          });

        return true;
      })
    ) as Source<OperationResult>;

    return result$;
  };
};
