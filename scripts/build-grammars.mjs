#!/usr/bin/env node
/**
 * Compile Lezer grammar files → TypeScript parser modules.
 * Usage: node scripts/build-grammars.mjs
 *
 * Scans src/lib/editor/lang-* / *.grammar and generates .ts parser files.
 */
import { buildParserFile } from "@lezer/generator";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, basename } from "path";

const EDITOR_DIR = "src/lib/editor";

// Find all lang-* subdirectories
const langDirs = readdirSync(EDITOR_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name.startsWith("lang-"))
  .map(d => join(EDITOR_DIR, d.name));

let compiled = 0;

for (const dir of langDirs) {
  const grammarFiles = readdirSync(dir).filter(f => f.endsWith(".grammar"));
  for (const grammarFile of grammarFiles) {
    const grammarPath = join(dir, grammarFile);
    const grammarText = readFileSync(grammarPath, "utf-8");
    const name = basename(grammarFile, ".grammar");

    console.log(`Compiling ${grammarPath}...`);

    const { parser, terms } = buildParserFile(grammarText, {
      fileName: `${name}.grammar`,
      moduleStyle: "es",
    });

    // Write parser module
    const parserPath = join(dir, `${name}.parser.ts`);
    // Convert ES module output to TS-compatible (add type annotations where needed)
    writeFileSync(parserPath, `// @generated from ${grammarFile} — do not edit\n${parser}`);

    // Write terms if present
    if (terms) {
      const termsPath = join(dir, `${name}.terms.ts`);
      writeFileSync(termsPath, `// @generated from ${grammarFile} — do not edit\n${terms}`);
    }

    compiled++;
    console.log(`  → ${parserPath}`);
  }
}

console.log(`\nCompiled ${compiled} grammar(s).`);
