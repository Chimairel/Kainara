// Conservative source inventory, not a runtime authorization or payload validator.
// Conditional router factories are combined; variable URLs are reported for manual tracing.
// Native fetch, indirect wrappers and external URLs require separate inspection.
const fs = require('node:fs'),
  path = require('node:path');
const ts = require('../backend/node_modules/typescript');
const root = path.resolve(__dirname, '..');
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? files(path.join(dir, e.name)) : /\.(tsx?|mjs)$/.test(e.name) ? [path.join(dir, e.name)] : []
    );
}
function parse(file) {
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
}
function walk(node, fn) {
  fn(node);
  ts.forEachChild(node, (n) => walk(n, fn));
}
function textPath(node) {
  if (!node) return null;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isTemplateExpression(node))
    return node.head.text + node.templateSpans.map((s) => ':dynamic' + s.literal.text).join('');
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken)
    return (textPath(node.left) ?? ':dynamic') + (textPath(node.right) ?? ':dynamic');
  return null;
}
const methods = ['get', 'post', 'put', 'patch', 'delete'];
const mounts = [];
const app = parse(path.join(root, 'backend/src/app.ts'));
walk(app, (n) => {
  if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'use') {
    const prefix = textPath(n.arguments[0]);
    if (!prefix) return;
    for (const arg of n.arguments.slice(1))
      if (ts.isIdentifier(arg) && arg.text.endsWith('Router')) mounts.push({ name: arg.text, prefix });
  }
});
const routerImports = new Map();
for (const s of app.statements)
  if (ts.isImportDeclaration(s) && s.importClause?.name)
    routerImports.set(s.importClause.name.text, s.moduleSpecifier.text.replace('@/', 'backend/src/') + '.ts');
const routes = [],
  visited = new Set();
function router(rel, prefix) {
  const key = rel + prefix;
  if (visited.has(key)) return;
  visited.add(key);
  const sf = parse(path.join(root, rel));
  const imports = new Map();
  for (const s of sf.statements)
    if (ts.isImportDeclaration(s)) {
      const name = s.moduleSpecifier.text;
      if (!name.includes('routes')) continue;
      const target = name.startsWith('@/')
        ? name.replace('@/', 'backend/src/') + '.ts'
        : path.relative(root, path.resolve(path.dirname(path.join(root, rel)), name + '.ts'));
      if (s.importClause?.name) imports.set(s.importClause.name.text, target);
      for (const item of s.importClause?.namedBindings?.elements ?? []) imports.set(item.name.text, target);
    }
  walk(sf, (n) => {
    if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return;
    const method = n.expression.name.text;
    if (methods.includes(method)) {
      const suffix = textPath(n.arguments[0]);
      if (suffix)
        routes.push({
          method,
          path: (prefix + suffix).replace(/\/$/, ''),
          file: rel.replaceAll('\\', '/'),
          line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
        });
    }
    if (method === 'use') {
      const sub = textPath(n.arguments[0]);
      for (const a of n.arguments.slice(sub === null ? 0 : 1)) {
        const name = ts.isIdentifier(a)
          ? a.text
          : ts.isCallExpression(a) && ts.isIdentifier(a.expression)
            ? a.expression.text
            : null;
        if (name && imports.has(name)) router(imports.get(name), prefix + (sub ?? ''));
      }
    }
  });
}
for (const mount of mounts) {
  const rel = routerImports.get(mount.name);
  if (rel) router(rel, mount.prefix);
}
walk(app, (n) => {
  if (
    ts.isCallExpression(n) &&
    ts.isPropertyAccessExpression(n.expression) &&
    methods.includes(n.expression.name.text)
  ) {
    const p = textPath(n.arguments[0]);
    if (p)
      routes.push({
        method: n.expression.name.text,
        path: p,
        file: 'backend/src/app.ts',
        line: app.getLineAndCharacterOfPosition(n.getStart()).line + 1,
      });
  }
});
const calls = [],
  dynamic = [];
const frontFiles = files(path.join(root, 'frontend/src'));
for (const file of frontFiles) {
  if (/\.(test|spec)\./.test(file)) continue;
  const sf = parse(file);
  walk(sf, (n) => {
    if (!ts.isCallExpression(n)) return;
    let method;
    if (
      ts.isPropertyAccessExpression(n.expression) &&
      methods.includes(n.expression.name.text) &&
      /^(api|client|authApi|authClient|axios)$/.test(n.expression.expression.getText(sf))
    )
      method = n.expression.name.text;
    else return;
    let p = textPath(n.arguments[0]);
    const info = {
      method,
      path: p,
      file: path.relative(root, file).replaceAll('\\', '/'),
      line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
    };
    if (!p) {
      dynamic.push({ ...info, expression: n.arguments[0]?.getText(sf) });
      return;
    }
    if (/^https?:/.test(p) || !p.startsWith('/')) return;
    p = p.split('?')[0].replace(/\/$/, '');
    if (!p.startsWith('/api')) p = '/api' + p;
    calls.push({ ...info, path: p });
  });
}
function matches(call, route) {
  if (call.method !== route.method) return false;
  const a = call.path.split('/'),
    b = route.path.split('/');
  return a.length === b.length && a.every((s, i) => s.startsWith(':') || b[i].startsWith(':') || s === b[i]);
}
const unmatched = calls.filter((c) => !routes.some((r) => matches(c, r)));
const result = {
  sourceFiles: files(path.join(root, 'backend/src')).length + frontFiles.length,
  mountedRouters: mounts.length,
  nestedRouterMounts: visited.size,
  routes: routes.length,
  calls: calls.length,
  unmatched,
  dynamic,
  callsInventory: calls,
  routesInventory: routes,
};
if (process.argv[2]) fs.writeFileSync(path.resolve(process.argv[2]), JSON.stringify(result, null, 2));
console.log(
  JSON.stringify({ ...result, callsInventory: undefined, routesInventory: undefined, dynamic: dynamic.length }, null, 2)
);
