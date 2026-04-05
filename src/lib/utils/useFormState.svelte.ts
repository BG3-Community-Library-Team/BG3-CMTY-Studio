export interface ValidationError {
  key: string;
  message: string;
  severity: "error" | "warning";
}

export interface FormStateOptions {
  validate: () => ValidationError[];
  onSave: (data: unknown) => void;
  onCancel: () => void;
}

export function createFormState(options: FormStateOptions) {
  let dirty: boolean = $state(false);

  const validationErrors: ValidationError[] = $derived(options.validate());
  const hasErrors: boolean = $derived(validationErrors.some((e) => e.severity === "error"));
  const hasWarnings: boolean = $derived(validationErrors.some((e) => e.severity === "warning"));

  function markDirty() {
    dirty = true;
  }

  function save(data: unknown) {
    options.onSave(data);
    dirty = false;
  }

  function cancel() {
    options.onCancel();
  }

  return {
    get dirty() { return dirty; },
    set dirty(v: boolean) { dirty = v; },
    get validationErrors() { return validationErrors; },
    get hasErrors() { return hasErrors; },
    get hasWarnings() { return hasWarnings; },
    markDirty,
    save,
    cancel,
  };
}
