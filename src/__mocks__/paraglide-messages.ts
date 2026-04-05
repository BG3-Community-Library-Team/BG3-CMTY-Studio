/**
 * Stub for paraglide messages — returns the message key as text.
 * Used by component tests that render components importing `{ m }`.
 */
type MessageFn = (params?: Record<string, unknown>) => string;

const handler: ProxyHandler<Record<string, MessageFn>> = {
  get(_target, prop: string) {
    if (prop === "__esModule") return true;
    if (typeof prop === "symbol") return undefined;
    return (params?: Record<string, unknown>) => {
      if (params && Object.keys(params).length > 0) {
        const vals = Object.values(params).join(", ");
        return `${prop}(${vals})`;
      }
      return prop;
    };
  },
};

export const m: Record<string, MessageFn> =
  new Proxy({} as Record<string, MessageFn>, handler);
