/** Stub for @tauri-apps/api/event — prevents import errors in tests */
export function listen(_event: string, _handler: (...args: any[]) => void): Promise<() => void> {
  return Promise.resolve(() => {});
}
