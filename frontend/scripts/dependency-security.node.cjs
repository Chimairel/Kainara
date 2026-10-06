const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const braces = require('braces');

const nested = (depth, open = '{', close = '}') => open.repeat(depth) + 'a,b' + close.repeat(depth);
const isDepthError = (error) => error instanceof SyntaxError && error.code === 'BRACES_DEPTH_LIMIT';

test('installed brace consumers resolve the maintained depth-guard fork', () => {
  const expected = require.resolve('braces');
  assert.equal(require('braces/package.json').name, '@nutrimind/braces-depth-guard');
  const sourceRoot = resolve(__dirname, '../vendor/braces');
  const files = Object.keys(JSON.parse(readFileSync(resolve(sourceRoot, 'upstream.json'))).files);
  for (const file of [...files, 'lib/depth-guard.js']) {
    assert.equal(
      readFileSync(resolve(dirname(expected), file), 'utf8'),
      readFileSync(resolve(sourceRoot, file), 'utf8'),
      `Installed fork source differs: ${file}`
    );
  }
  for (const consumer of ['micromatch', 'chokidar', 'fast-glob']) {
    const scoped = createRequire(require.resolve(consumer));
    assert.equal(scoped.resolve('braces'), expected);
  }
  const lock = JSON.parse(readFileSync(resolve(__dirname, '../package-lock.json')));
  const registryBraces = Object.entries(lock.packages).filter(
    ([path, entry]) => path.endsWith('/braces') && entry.resolved?.startsWith('https:')
  );
  assert.deepEqual(registryBraces, []);
  assert.equal(lock.packages['node_modules/postcss-selector-parser'].version, '7.1.6');
});

test('ordinary brace lists, numeric ranges, escaping and nested patterns retain their output', () => {
  assert.deepEqual(braces.expand('src/*.{ts,tsx,js,jsx,mdx}'), [
    'src/*.ts',
    'src/*.tsx',
    'src/*.js',
    'src/*.jsx',
    'src/*.mdx',
  ]);
  assert.deepEqual(braces.expand('a{b,{c,d}}e'), ['abe', 'ace', 'ade']);
  assert.deepEqual(braces.expand('meal-{01..03}'), ['meal-01', 'meal-02', 'meal-03']);
  assert.equal(braces.compile('src/*.{ts,tsx}'), 'src/*.(ts|tsx)');
  assert.deepEqual(braces.expand('\\{a,b\\}'), ['{a,b}']);
  assert.equal(braces.stringify(braces.parse('src/*.{ts,tsx}')), 'src/*.{ts,tsx}');
  assert.deepEqual(braces(['x{a,b}', 'x{a,b}'], { expand: true, nodupes: true }), ['xa', 'xb']);
});

test('all public string paths reject excessive braces, parentheses and mixed nesting', () => {
  for (const input of [nested(3500), nested(3500, '(', ')'), nested(200, '{(', ')}')]) {
    for (const method of [braces, braces.parse, braces.compile, braces.expand, braces.stringify, braces.create]) {
      assert.throws(() => method(input, { maxDepth: Infinity }), isDepthError);
    }
  }
  assert.doesNotThrow(() => braces.compile(nested(100)));
  assert.throws(() => braces.compile(nested(101)), isDepthError);
  assert.throws(() => braces.parse('{'.repeat(101)), isDepthError);
});

test('quoted, escaped and bracket-literal delimiters do not consume parser nesting budget', () => {
  assert.doesNotThrow(() => braces.compile('"' + nested(500) + '"'));
  assert.doesNotThrow(() => braces.compile('[' + '{'.repeat(500) + ']'));
  assert.doesNotThrow(() => braces.compile('\\{'.repeat(500)));
});

test('public AST paths reject deep trees and child-edge cycles before recursive walkers', () => {
  const root = { type: 'root', nodes: [] };
  let current = root;
  for (let i = 0; i < 3500; i++) {
    const child = { type: 'brace', nodes: [], parent: current };
    current.nodes.push(child);
    current = child;
  }
  for (const method of [braces.compile, braces.expand, braces.stringify]) {
    assert.throws(() => method(root), isDepthError);
  }
  const cycle = { type: 'root', nodes: [] };
  cycle.nodes.push(cycle);
  for (const method of [braces.compile, braces.expand, braces.stringify]) {
    assert.throws(() => method(cycle), isDepthError);
  }
});

test('published stack-exhaustion shapes fail with a controlled error in a bounded subprocess', () => {
  const child = spawnSync(
    process.execPath,
    [
      '-e',
      `
    const braces = require('braces');
    const pattern = '{'.repeat(4000) + 'a,b' + '}'.repeat(4000);
    for (const method of [braces.compile, braces.expand]) {
      try { method(pattern); process.exit(2); }
      catch (error) { if (error.code !== 'BRACES_DEPTH_LIMIT') throw error; }
    }
  `,
    ],
    { cwd: resolve(__dirname, '..'), timeout: 5000, encoding: 'utf8' }
  );
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
});

test('patched selector parser handles long flat selectors in a bounded subprocess', () => {
  const child = spawnSync(
    process.execPath,
    [
      '-e',
      `
    const parser = require('postcss-selector-parser');
    const selector = Array.from({length: 20000}, (_, i) => '.x' + i).join(',');
    const ast = parser().astSync(selector);
    if (ast.nodes.length !== 20000) process.exit(2);
  `,
    ],
    { cwd: resolve(__dirname, '..'), timeout: 5000, encoding: 'utf8' }
  );
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
});
