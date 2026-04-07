/**
 * PF-007: Toast Notification System
 *
 * Centralized reactive toast store with severity levels, auto-dismiss,
 * deduplication, theme-aware styling, and notification history.
 */

import { settingsStore } from "./settingsStore.svelte.js";

export type ToastLevel = "success" | "info" | "warning" | "error";

export interface Toast {
  id: number;
  level: ToastLevel;
  title: string;
  message?: string;
  /** Optional action link (dispatched via action registry) */
  action?: { label: string; actionId: string };
  /** Deduplication counter */
  count: number;
  /** Timestamp of creation */
  createdAt: number;
}

export interface ToastHistoryEntry {
  id: number;
  level: ToastLevel;
  title: string;
  message?: string;
  count: number;
  createdAt: number;
  /** Whether this entry has been read (seen in history panel) */
  read: boolean;
}

const MAX_VISIBLE = 5;
const MAX_HISTORY = 50;

let nextId = 1;
let toasts = $state<Toast[]>([]);
let history = $state<ToastHistoryEntry[]>([]);
let unreadCount = $state(0);
const timers = new Map<number, ReturnType<typeof setTimeout>>();

/** Get the effective auto-dismiss duration for a toast level.
 *  Uses settingsStore.toastDuration for non-error toasts, settingsStore.errorToastDuration for errors. */
function getAutoDismissMs(level: ToastLevel): number {
  if (level === "error") return settingsStore.errorToastDuration;
  return settingsStore.toastDuration;
}

function addToHistory(toast: Toast): void {
  const entry: ToastHistoryEntry = {
    id: toast.id,
    level: toast.level,
    title: toast.title,
    message: toast.message,
    count: toast.count,
    createdAt: toast.createdAt,
    read: false,
  };
  history = [entry, ...history];
  if (history.length > MAX_HISTORY) {
    history = history.slice(0, MAX_HISTORY);
  }
  unreadCount = history.filter(h => !h.read).length;
}

function updateHistoryCount(toastId: number, count: number): void {
  const entry = history.find(h => h.id === toastId);
  if (entry) {
    entry.count = count;
    entry.createdAt = Date.now();
  }
}

function addToast(level: ToastLevel, title: string, message?: string, action?: Toast["action"]): number {
  // Deduplication: if a toast with same title + level exists, increment count
  const existing = toasts.find(t => t.title === title && t.level === level);
  if (existing) {
    existing.count++;
    existing.createdAt = Date.now();
    updateHistoryCount(existing.id, existing.count);
    // Reset auto-dismiss timer
    const old = timers.get(existing.id);
    if (old) clearTimeout(old);
    scheduleAutoDismiss(existing.id, level);
    return existing.id;
  }

  const id = nextId++;
  const toast: Toast = { id, level, title, message, action, count: 1, createdAt: Date.now() };
  toasts = [toast, ...toasts];

  // Log errors to console for debugging
  if (level === "error") {
    console.error(`[Toast Error] ${title}${message ? ": " + message : ""}`);
  }

  // Add to history
  addToHistory(toast);

  // Trim to max visible
  if (toasts.length > MAX_VISIBLE) {
    const removed = toasts.splice(MAX_VISIBLE);
    for (const r of removed) {
      const t = timers.get(r.id);
      if (t) { clearTimeout(t); timers.delete(r.id); }
    }
  }

  scheduleAutoDismiss(id, level);
  return id;
}

function scheduleAutoDismiss(id: number, level: ToastLevel): void {
  const ms = getAutoDismissMs(level);
  if (ms <= 0) return;
  const timer = setTimeout(() => dismiss(id), ms);
  timers.set(id, timer);
}

function dismiss(id: number): void {
  toasts = toasts.filter(t => t.id !== id);
  const timer = timers.get(id);
  if (timer) { clearTimeout(timer); timers.delete(id); }
}

function clear(): void {
  for (const [, timer] of timers) clearTimeout(timer);
  timers.clear();
  toasts = [];
}

/** Pause auto-dismiss (e.g. on hover) */
function pauseDismiss(id: number): void {
  const timer = timers.get(id);
  if (timer) { clearTimeout(timer); timers.delete(id); }
}

/** Resume auto-dismiss after hover */
function resumeDismiss(id: number): void {
  const toast = toasts.find(t => t.id === id);
  if (toast) scheduleAutoDismiss(id, toast.level);
}

/** Mark all history entries as read */
function markAllRead(): void {
  for (const entry of history) {
    entry.read = true;
  }
  unreadCount = 0;
}

/** Remove a single entry from history */
function removeFromHistory(id: number): void {
  const wasUnread = history.find(h => h.id === id && !h.read);
  history = history.filter(h => h.id !== id);
  if (wasUnread) {
    unreadCount = Math.max(0, unreadCount - 1);
  }
}

/** Clear all history */
function clearHistory(): void {
  history = [];
  unreadCount = 0;
}

const toastActions = new Map<string, () => void>();

function registerToastAction(id: string, handler: () => void): void {
  toastActions.set(id, handler);
}

function unregisterToastAction(id: string): void {
  toastActions.delete(id);
}

function executeToastAction(id: string): void {
  toastActions.get(id)?.();
}

export const toastStore = {
  get toasts() { return toasts; },
  get history() { return history; },
  get unreadCount() { return unreadCount; },
  dismiss,
  clear,
  pauseDismiss,
  resumeDismiss,
  markAllRead,
  removeFromHistory,
  clearHistory,
  registerToastAction,
  unregisterToastAction,
  executeToastAction,
  success: (title: string, message?: string, action?: Toast["action"]) => addToast("success", title, message, action),
  info: (title: string, message?: string, action?: Toast["action"]) => addToast("info", title, message, action),
  warning: (title: string, message?: string, action?: Toast["action"]) => addToast("warning", title, message, action),
  error: (title: string, message?: string, action?: Toast["action"]) => addToast("error", title, message, action),
};
