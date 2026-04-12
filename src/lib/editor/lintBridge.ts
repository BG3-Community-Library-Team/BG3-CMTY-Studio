import { linter, type Diagnostic } from "@codemirror/lint";
import { validateScript } from "../tauri/scripts.js";
import type { ScriptLanguage } from "./types.js";
import type { Extension } from "@codemirror/state";

/** CM6 linter that calls the Rust validateScript IPC and maps results to inline diagnostics. */
export function bg3Linter(filePath: string, language: ScriptLanguage | string, projectPath?: string): Extension {
  return linter(async (view): Promise<Diagnostic[]> => {
    try {
      const content = view.state.doc.toString();
      const results = await validateScript(filePath, language, content, projectPath);
      const diagnostics: Diagnostic[] = [];

      for (const d of results) {
        if (d.line < 1 || d.line > view.state.doc.lines) continue;
        const line = view.state.doc.line(d.line);
        diagnostics.push({
          from: line.from,
          to: line.to,
          severity: d.severity.toLowerCase() as "error" | "warning" | "info",
          message: d.message,
          source: d.source || "bg3-lint",
        });
      }

      return diagnostics;
    } catch {
      return [];
    }
  }, { delay: 500 });
}

/** No-op linter extension for when no filePath is available. */
export const noopLinter: Extension = [];
