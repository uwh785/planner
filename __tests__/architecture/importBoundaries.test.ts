import fs from 'fs';
import path from 'path';

const src = path.resolve(__dirname, '../../src');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function importsOf(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8');
  const found = [...text.matchAll(/(?:from|import|require\()\s*['"]([^'"]+)['"]/g)];
  return found.map(m => m[1] ?? '');
}

const isFramework = (spec: string) =>
  /^(react|react-native|@react-native|@op-engineering)(\/|$)/.test(spec) ||
  /^node:/.test(spec) ||
  ['fs', 'path', 'os', 'crypto'].includes(spec);

describe('hexagonal import boundaries', () => {
  it('keeps domain free of framework and cross-layer imports', () => {
    for (const file of sourceFiles(path.join(src, 'domain'))) {
      for (const spec of importsOf(file)) {
        expect({ file, spec, bad: isFramework(spec) || /^@\/(application|infrastructure|presentation)/.test(spec) }).toMatchObject({ bad: false });
      }
    }
  });

  it('keeps application dependent on domain only', () => {
    for (const file of sourceFiles(path.join(src, 'application'))) {
      for (const spec of importsOf(file)) {
        expect({ file, spec, bad: isFramework(spec) || /^@\/(infrastructure|presentation)/.test(spec) }).toMatchObject({ bad: false });
      }
    }
  });

  it('never imports the Node-only test adapter from app code', () => {
    const offenders = sourceFiles(src)
      .filter(f => !f.endsWith('NodeSqliteDatabase.ts'))
      .filter(f => importsOf(f).some(s => /NodeSqliteDatabase|node:sqlite/.test(s)));
    expect(offenders).toEqual([]);
  });
});
