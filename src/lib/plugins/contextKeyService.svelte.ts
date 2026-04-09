/**
 * EXT-2: Context Key Service — reactive context map + when clause evaluator.
 *
 * Context keys are string→value pairs set by the app and plugins.
 * When clause expressions evaluate against these keys to control
 * command visibility, view visibility, and status bar items.
 */
import { untrack } from "svelte";

class ContextKeyService {
  private keys: Map<string, unknown> = $state(new Map());

  /** Set a context key value. Triggers reactive updates. */
  set(key: string, value: unknown): void {
    // untrack the read so callers inside $effect don't subscribe to keys
    const next = new Map(untrack(() => this.keys));
    next.set(key, value);
    this.keys = next;
  }

  /** Remove a context key. */
  delete(key: string): void {
    if (!untrack(() => this.keys.has(key))) return;
    const next = new Map(untrack(() => this.keys));
    next.delete(key);
    this.keys = next;
  }

  /** Get current value of a key. */
  get(key: string): unknown {
    return this.keys.get(key);
  }

  /** Evaluate a when clause expression against current context.
   *  Returns false for empty/invalid expressions (fail-closed). */
  evaluate(expression: string | undefined): boolean {
    if (!expression || !expression.trim()) return true; // No clause = always visible
    try {
      return this.evalExpression(expression.trim());
    } catch {
      return false; // Fail closed on parse errors
    }
  }

  /** Internal expression evaluator */
  private evalExpression(expr: string): boolean {
    // Handle OR (lowest precedence) — split on ||
    const orParts = this.splitOnOperator(expr, "||");
    if (orParts.length > 1) {
      return orParts.some((part) => this.evalExpression(part.trim()));
    }

    // Handle AND — split on &&
    const andParts = this.splitOnOperator(expr, "&&");
    if (andParts.length > 1) {
      return andParts.every((part) => this.evalExpression(part.trim()));
    }

    // Handle negation: !key
    if (expr.startsWith("!")) {
      return !this.evalExpression(expr.slice(1).trim());
    }

    // Handle equality: key == value
    if (expr.includes("==")) {
      const [left, right] = expr.split("==").map((s) => s.trim());
      const val = this.keys.get(left);
      return String(val) === this.stripQuotes(right);
    }

    // Handle inequality: key != value
    if (expr.includes("!=")) {
      const [left, right] = expr.split("!=").map((s) => s.trim());
      const val = this.keys.get(left);
      return String(val) !== this.stripQuotes(right);
    }

    // Simple truthy check: key
    const val = this.keys.get(expr);
    return !!val;
  }

  /** Split expression on operator, respecting simple nesting */
  private splitOnOperator(expr: string, op: string): string[] {
    const parts: string[] = [];
    let current = "";
    let i = 0;
    while (i < expr.length) {
      if (expr.substring(i, i + op.length) === op) {
        parts.push(current);
        current = "";
        i += op.length;
      } else {
        current += expr[i];
        i++;
      }
    }
    parts.push(current);
    return parts;
  }

  /** Strip surrounding quotes from a value string */
  private stripQuotes(s: string): string {
    if (
      (s.startsWith("'") && s.endsWith("'")) ||
      (s.startsWith('"') && s.endsWith('"'))
    ) {
      return s.slice(1, -1);
    }
    return s;
  }
}

export const contextKeys = new ContextKeyService();
