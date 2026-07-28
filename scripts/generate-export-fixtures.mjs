#!/usr/bin/env node
// Bundles the exporters and writes real generated output for each target
// language to export-check/, so CI can hand each file to its real compiler
// (cargo, go, python, node) instead of trusting the exporter's own snapshot
// tests. See .github/workflows/ci.yml.

import { build } from 'esbuild';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const outDir = path.join(repoRoot, 'export-check');

const EXTENSIONS = {
  ratatui: 'rs',
  bubbletea: 'go',
  tview: 'go',
  textual: 'py',
  blessed: 'js',
  opentui: 'tsx',
  ink: 'tsx',
};

async function main() {
  const result = await build({
    stdin: {
      contents: `
        export { exportToCode } from '${path.join(repoRoot, 'src/utils/export/codeExporter')}';
        export { kitchenSinkTree } from '${path.join(repoRoot, 'src/utils/export/__tests__/fixtures')}';
      `,
      resolveDir: repoRoot,
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  });

  const bundlePath = path.join(os.tmpdir(), `export-check-bundle-${Date.now()}.mjs`);
  writeFileSync(bundlePath, result.outputFiles[0].text);
  const { exportToCode, kitchenSinkTree } = await import(bundlePath);

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const tree = kitchenSinkTree();
  for (const [format, ext] of Object.entries(EXTENSIONS)) {
    const code = exportToCode(tree, format);
    writeFileSync(path.join(outDir, `${format}.${ext}`), code);
    console.log(`wrote export-check/${format}.${ext}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
