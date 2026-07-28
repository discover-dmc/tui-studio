import { describe, it, expect } from 'vitest';
import type { ExportFormatId } from '../../../types';
import { exportToCode, getExportWarnings } from '../codeExporter';
import { kitchenSinkTree, emptyScreenTree, textOnlyTree } from './fixtures';

const FORMATS: ExportFormatId[] = ['ink', 'opentui', 'bubbletea', 'blessed', 'textual', 'ratatui'];

describe('exportToCode snapshots', () => {
  for (const format of FORMATS) {
    it(`${format}: kitchen-sink tree`, () => {
      expect(exportToCode(kitchenSinkTree(), format)).toMatchSnapshot();
    });

    it(`${format}: empty screen`, () => {
      expect(exportToCode(emptyScreenTree(), format)).toMatchSnapshot();
    });

    it(`${format}: text-only tree`, () => {
      expect(exportToCode(textOnlyTree(), format)).toMatchSnapshot();
    });
  }
});

describe('exporter regressions', () => {
  it('Blessed: no duplicate variable declarations (root "Screen" no longer redeclares const screen)', () => {
    const out = exportToCode(kitchenSinkTree(), 'blessed');
    // widget declarations only — excludes the one blessed.screen(...) boilerplate call
    const decls = [...out.matchAll(/const (\w+) = blessed\.(?!screen\()\w+\(/g)].map((m) => m[1]);
    expect(decls.length).toBeGreaterThan(0);
    expect(new Set(decls).size).toBe(decls.length);
    expect(decls).not.toContain('screen');
  });

  it('Blessed: compiles as valid JavaScript syntax', () => {
    const out = exportToCode(kitchenSinkTree(), 'blessed');
    expect(() => new Function(out.replace(/^const blessed = require.*$/m, ''))).not.toThrow();
  });

  it('Textual: compose body is indented deeper than the def line (regression for the IndentationError bug)', () => {
    const out = exportToCode(kitchenSinkTree(), 'textual');
    const defLine = out.split('\n').findIndex((l) => l.includes('def compose(self)'));
    expect(defLine).toBeGreaterThanOrEqual(0);
    const defIndent = out.split('\n')[defLine].match(/^(\s*)/)![1].length;
    const bodyLine = out.split('\n')[defLine + 1];
    const bodyIndent = bodyLine.match(/^(\s*)/)![1].length;
    expect(bodyIndent).toBeGreaterThan(defIndent);
  });

  it('Textual: escapes embedded quotes so the file stays parseable', () => {
    const out = exportToCode(kitchenSinkTree(), 'textual');
    expect(out).toContain('Say \\"hi\\" to <all>');
  });

  it('BubbleTea: skips Modal nodes and documents the omission instead of misrendering them', () => {
    const out = exportToCode(kitchenSinkTree(), 'bubbletea');
    expect(out).toContain('NOT exported');
    expect(out).toContain('Modal "Confirm"');
    expect(out).not.toContain('Sure?');
  });

  it('BubbleTea: gofmt-shape sanity — no stray tabs-vs-spaces mix, balanced braces', () => {
    const out = exportToCode(kitchenSinkTree(), 'bubbletea');
    const opens = (out.match(/{/g) || []).length;
    const closes = (out.match(/}/g) || []).length;
    expect(opens).toBe(closes);
  });

  it('OpenTUI: preserves text content instead of dropping it (regression for the empty <Text /> bug)', () => {
    const out = exportToCode(kitchenSinkTree(), 'opentui');
    // JSX text content: quotes are literal, only {}<>& need escaping
    expect(out).toContain('Say "hi" to &lt;all&gt;');
    expect(out).toContain('Sure?'); // Modal content still renders, just not as an overlay
  });

  it('OpenTUI: uses the real @opentui/react intrinsic elements, not fictional ones', () => {
    const out = exportToCode(kitchenSinkTree(), 'opentui');
    expect(out).toContain('@opentui/react');
    expect(out).toMatch(/<box/);
    expect(out).toMatch(/<text/);
  });

  it('Ink: border color comes from style.borderColor, not the text color (regression)', () => {
    const tree = kitchenSinkTree();
    const out = exportToCode(tree, 'ink');
    // Files list has color unset but borderColor: 'red'
    expect(out).toContain('borderColor="red"');
  });

  it('Ratatui: gates widget imports to what the tree actually uses', () => {
    const out = exportToCode(textOnlyTree(), 'ratatui');
    expect(out).not.toContain('Table');
    expect(out).not.toContain('Tabs');
    expect(out).not.toContain('Gauge');
  });

  it('Ratatui: escapes quotes in Rust string literals', () => {
    const out = exportToCode(kitchenSinkTree(), 'ratatui');
    expect(out).toContain('Say \\"hi\\" to <all>');
  });
});

describe('getExportWarnings', () => {
  it('flags BubbleTea Modal and fill-sizing as unsupported', () => {
    const warnings = getExportWarnings(kitchenSinkTree(), 'bubbletea');
    expect(warnings.some((w) => w.includes('Modal'))).toBe(true);
    expect(warnings.some((w) => w.includes('fill'))).toBe(true);
  });

  it('flags OpenTUI Modal as unsupported', () => {
    const warnings = getExportWarnings(kitchenSinkTree(), 'opentui');
    expect(warnings.some((w) => w.includes('Modal'))).toBe(true);
  });

  it('returns no warnings for formats without special-cased limitations', () => {
    for (const format of ['ink', 'blessed', 'textual', 'ratatui'] as ExportFormatId[]) {
      expect(getExportWarnings(kitchenSinkTree(), format)).toEqual([]);
    }
  });

  it('returns [] for a null root', () => {
    expect(getExportWarnings(null, 'bubbletea')).toEqual([]);
  });
});

describe('empty tree handling', () => {
  it('every exporter handles a childless Screen without throwing', () => {
    for (const format of FORMATS) {
      expect(() => exportToCode(emptyScreenTree(), format)).not.toThrow();
    }
  });

  it('exportToCode returns empty string for a null root', () => {
    expect(exportToCode(null, 'ink')).toBe('');
  });
});
