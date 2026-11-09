// A stand-in for the Drizzle client in tests that exercise server actions.
// Any query chain (db.select().from().where().limit(), db.insert()...returning())
// resolves, when awaited, to the next queued result, in call order. Each
// chain's first method name is recorded so a test can assert that, say,
// no delete was ever issued.
//
// Tests queue one result per awaited query: fakeDb.queue([row], [], ...).

type Result = unknown;

export function createFakeDb() {
  const results: Result[] = [];
  const calls: string[] = [];
  // Every .values(...) passed to an insert, in order.
  const inserted: unknown[] = [];

  const chain = (): unknown =>
    new Proxy(function () {}, {
      get(_target, prop) {
        if (prop === "then") {
          const next = results.length > 0 ? results.shift() : [];
          return (resolve: (value: Result) => void) => resolve(next);
        }
        return (...args: unknown[]) => {
          if (prop === "values") inserted.push(args[0]);
          return chain();
        };
      },
      apply() {
        return chain();
      },
    });

  const db = new Proxy(
    {},
    {
      get(_target, prop) {
        return () => {
          calls.push(String(prop));
          return chain();
        };
      },
    }
  );

  return {
    db,
    calls,
    inserted,
    queue(...next: Result[]) {
      results.push(...next);
    },
    reset() {
      results.length = 0;
      calls.length = 0;
      inserted.length = 0;
    },
  };
}
