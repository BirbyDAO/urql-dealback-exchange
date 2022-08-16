import { makeSubject, map, pipe, publish, tap } from 'wonka';

import {
  CombinedError,
  createClient,
  ExchangeIO,
  gql,
  Operation,
  OperationResult,
} from '@urql/core';

import { redialExchange } from './redialExchange';

const dispatchDebug = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

const mockOptions = {
  initialDelayMs: 50,
  maxDelayMs: 500,
  randomDelay: true,
  maxNumberAttempts: 10,
  retryUntilPatternSucceeds: {
    author: '$.author.id',
    complex: ['$.complex.path.to.match', '$.with.multiple.results'],
  },
};

// noinspection GraphQLUnresolvedReference
const queryOne = gql`
  query author {
    author {
      id
      name
    }
  }
`;

const queryOneData = {
  __typename: 'Query',
  author: {
    __typename: 'Author',
    id: '123',
    name: 'Author',
  },
};

const queryOneEmpty = {
  __typename: 'Query',
  author: null,
};

const queryOneError = {
  name: 'error',
  message: 'scary error',
};

let client, op, ops$, next;
beforeEach(() => {
  client = createClient({ url: 'http://0.0.0.0' });
  op = client.createRequestOperation('query', {
    key: 1,
    query: queryOne,
  });

  ({ source: ops$, next } = makeSubject<Operation>());
});

it(`retries response doesn't have result`, () => {
  const response = jest.fn(
    (forwardOp: Operation): OperationResult => {
      expect(forwardOp.key === op.key).toBeTruthy();

      return {
        operation: forwardOp,
        data: queryOneEmpty,
      };
    }
  );

  const result = jest.fn();
  const forward: ExchangeIO = ops$ => {
    return pipe(ops$, map(response));
  };

  pipe(
    redialExchange(mockOptions)({
      forward,
      client,
      dispatchDebug,
    })(ops$),
    tap(result),
    publish
  );

  next(op);

  jest.runAllTimers();

  expect(response).toHaveBeenCalledTimes(mockOptions.maxNumberAttempts);

  // result should only ever be called once per operation
  expect(result).toHaveBeenCalledTimes(1);
});

it(`should not retry on errors`, () => {
  const response = jest.fn(
    (forwardOp: Operation): OperationResult => {
      expect(forwardOp.key === op.key).toBeTruthy();

      return {
        operation: forwardOp,
        error: queryOneError as CombinedError,
      };
    }
  );

  const result = jest.fn();
  const forward: ExchangeIO = ops$ => {
    return pipe(ops$, map(response));
  };

  pipe(
    redialExchange(mockOptions)({
      forward,
      client,
      dispatchDebug,
    })(ops$),
    tap(result),
    publish
  );

  next(op);

  jest.runAllTimers();

  expect(response).toHaveBeenCalledTimes(1);

  // result should only ever be called once per operation
  expect(result).toHaveBeenCalledTimes(1);
});

it(`should not retry on unknown queries`, () => {
  // noinspection GraphQLUnresolvedReference
  const queryTwo = gql`
    query NOT_EXISTENT_NAME {
      films {
        id
        name
      }
    }
  `;
  const opTwo = client.createRequestOperation('query', {
    key: 2,
    query: queryTwo,
  });

  const response = jest.fn(
    (forwardOp: Operation): OperationResult => ({
      operation: forwardOp,
      data: { films: null },
    })
  );

  const result = jest.fn();
  const forward: ExchangeIO = ops$ => {
    return pipe(ops$, map(response));
  };

  pipe(
    redialExchange(mockOptions)({
      forward,
      client,
      dispatchDebug,
    })(ops$),
    tap(result),
    publish
  );

  next(opTwo);

  jest.runAllTimers();

  expect(response).toHaveBeenCalledTimes(1);
  expect(result).toHaveBeenCalledTimes(1);
  expect(result.mock.calls[0][0]).toMatchObject({
    data: { films: null },
  });
});

it('should retry x number of times and then return the successful result', () => {
  const numberRetriesBeforeSuccess = 3;
  const response = jest.fn(
    (forwardOp: Operation): OperationResult => {
      expect(forwardOp.key).toBe(op.key);
      // @ts-ignore
      return {
        operation: forwardOp,
        ...(forwardOp.context.retryCount! >= numberRetriesBeforeSuccess
          ? { data: queryOneData }
          : { data: queryOneEmpty }),
      };
    }
  );

  const result = jest.fn();
  const forward: ExchangeIO = ops$ => {
    return pipe(ops$, map(response));
  };

  pipe(
    redialExchange(mockOptions)({
      forward,
      client,
      dispatchDebug,
    })(ops$),
    tap(result),
    publish
  );

  next(op);
  jest.runAllTimers();

  // one for original source, one for retry
  expect(response).toHaveBeenCalledTimes(1 + numberRetriesBeforeSuccess);
  expect(result).toHaveBeenCalledTimes(1);
});

it('should retry until all matches succeed', () => {
  const numberRetriesBeforeSuccess = 1;

  const queryTwo = gql`
    # noinspection GraphQLUnresolvedReference

    query complex {
      complex {
        path {
          to {
            match
          }
        }
      }
      with {
        multiple {
          results
        }
      }
    }
  `;
  const opTwo = client.createRequestOperation('query', {
    key: 2,
    query: queryTwo,
  });

  const queryTwoHalfEmpty = {
    complex: { path: { to: { match: 'true' } } },
  };
  const queryTwoData = {
    ...queryTwoHalfEmpty,
    with: { multiple: { results: [] } },
  };

  const response = jest.fn(
    (forwardOp: Operation): OperationResult => {
      expect(forwardOp.key).toBe(opTwo.key);
      // @ts-ignore
      return {
        operation: forwardOp,
        ...(forwardOp.context.retryCount! >= numberRetriesBeforeSuccess
          ? { data: queryTwoData }
          : { data: queryTwoHalfEmpty }),
      };
    }
  );

  const result = jest.fn();
  const forward: ExchangeIO = ops$ => {
    return pipe(ops$, map(response));
  };

  pipe(
    redialExchange(mockOptions)({
      forward,
      client,
      dispatchDebug,
    })(ops$),
    tap(result),
    publish
  );

  next(opTwo);
  jest.runAllTimers();

  // one for original source, one for retry
  expect(response).toHaveBeenCalledTimes(1 + numberRetriesBeforeSuccess);
  expect(result).toHaveBeenCalledTimes(1);
  expect(result.mock.calls[0][0]).toMatchObject({ data: queryTwoData });
});
