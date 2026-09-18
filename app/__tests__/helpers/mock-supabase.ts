import { vi } from "vitest";

type MockResult = { data?: unknown; error?: unknown; count?: number };

/**
 * Chainable Supabase mock for server-action unit tests.
 *
 * Usage:
 *   const { supabase, mockResult } = createMockSupabase();
 *   vi.mocked(createServerSupabase).mockResolvedValue(supabase as any);
 *   mockResult("creator_profiles", "maybeSingle", { data: { handle: "alice" } });
 */
export function createMockSupabase() {
  // Per-table, per-terminal-method result overrides
  const results = new Map<string, MockResult>();
  // Per-RPC-name result overrides
  const rpcResults = new Map<string, MockResult>();
  // Auth method result overrides
  const authResults = new Map<string, MockResult>();

  function key(table: string, method: string) {
    return `${table}::${method}`;
  }

  /** Set what a terminal call returns.  e.g. mockResult("offerings", "insert", { error: null }) */
  function mockResult(table: string, method: string, result: MockResult) {
    results.set(key(table, method), result);
  }

  /** Set what supabase.rpc(name) returns. */
  function mockRpc(name: string, result: MockResult) {
    rpcResults.set(name, result);
  }

  /** Set what an auth method returns.  e.g. mockAuth("signUp", { error: null }) */
  function mockAuth(method: string, result: MockResult) {
    authResults.set(method, result);
  }

  // Track the current table context for chaining
  let currentTable = "";

  const TERMINAL_METHODS = [
    "maybeSingle", "single", "insert", "update", "delete", "upsert",
  ] as const;

  const defaultResult: MockResult = { data: null, error: null, count: 0 };

  // Build chainable query builder
  function makeChain(): Record<string, any> {
    const chain: Record<string, any> = {};
    // Chaining methods just return the chain
    for (const m of ["select", "eq", "neq", "gt", "gte", "lt", "lte",
      "in", "is", "like", "ilike", "contains", "order", "limit",
      "range", "filter", "match", "not", "or", "textSearch"]) {
      chain[m] = vi.fn((..._args: unknown[]) => chain);
    }
    // Terminal methods return the configured result
    for (const m of TERMINAL_METHODS) {
      chain[m] = vi.fn(() => {
        const r = results.get(key(currentTable, m));
        return Promise.resolve(r ?? defaultResult);
      });
    }
    // insert/update/delete/upsert also start chains but are terminal by default
    // Override insert to be both chainable AND return a result
    for (const m of ["insert", "update", "delete", "upsert"] as const) {
      chain[m] = vi.fn((..._args: unknown[]) => {
        // If chaining continues (e.g. .update({}).eq().select().maybeSingle()),
        // the terminal at the end resolves. But if this IS the terminal, resolve now.
        const result = results.get(key(currentTable, m));
        const wrapper = { ...chain };
        // Override .then so it can be awaited directly
        wrapper.then = (resolve: any, reject?: any) => {
          return Promise.resolve(result ?? defaultResult).then(resolve, reject);
        };
        return wrapper;
      });
    }
    return chain;
  }

  const queryChain = makeChain();

  const rpc = vi.fn((name: string, _params?: unknown) => {
    const result = rpcResults.get(name) ?? defaultResult;
    return Promise.resolve(result);
  });

  // Auth mock
  function makeAuthMethod(name: string) {
    return vi.fn((..._args: unknown[]) => {
      const result = authResults.get(name) ?? defaultResult;
      return Promise.resolve(result);
    });
  }

  const auth = {
    signUp: makeAuthMethod("signUp"),
    signInWithPassword: makeAuthMethod("signInWithPassword"),
    signOut: makeAuthMethod("signOut"),
    getUser: makeAuthMethod("getUser"),
    getClaims: makeAuthMethod("getClaims"),
    resetPasswordForEmail: makeAuthMethod("resetPasswordForEmail"),
    updateUser: makeAuthMethod("updateUser"),
  };

  // Storage mock
  const storage = {
    from: vi.fn((_bucket: string) => ({
      upload: vi.fn(() => Promise.resolve({ error: null })),
      getPublicUrl: vi.fn((path: string) => ({
        data: { publicUrl: `https://storage.test/${path}` },
      })),
    })),
  };

  const supabase = {
    from: vi.fn((table: string) => {
      currentTable = table;
      return queryChain;
    }),
    rpc,
    auth,
    storage,
  };

  /** Reset all configured result overrides and clear all mocks */
  function reset() {
    results.clear();
    rpcResults.clear();
    authResults.clear();
    vi.clearAllMocks();
  }

  return { supabase, mockResult, mockRpc, mockAuth, reset };
}

export type MockSupabase = ReturnType<typeof createMockSupabase>;
