# urql-exchange-redial (Exchange factory)

`urql-exchange-redial` is an exchange for the [`urql`](https://formidable.com/open-source/urql)
GraphQL client that allows operations (queries, mutations, subscriptions) to be retried based on
an `options` parameter.

## Quick Start Guide

First install `urql-exchange-redial` alongside `urql`.

Then use it like this:

```javascript
const exchange = redialExchange({
  initialDelayMs: 1000,
  maxDelayMs: 15000,
  randomDelay: true,
  maxNumberAttempts: 100,
  retryUntilPatternSucceeds: {
    queryName: '$.queryResult.id',
    anotherQueryName: ['$.result.id', '$.result.nestedResult'],
  },
});
```
