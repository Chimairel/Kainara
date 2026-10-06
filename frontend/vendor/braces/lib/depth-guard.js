'use strict';

// Fixed limits cannot be disabled by caller options. See upstream issue #70.
const MAX_NESTING = 100;
const MAX_AST_DEPTH = MAX_NESTING + 2;
const MAX_AST_NODES = 50000;

const depthError = () => {
  const error = new SyntaxError('Brace pattern exceeds the supported nesting depth');
  error.code = 'BRACES_DEPTH_LIMIT';
  return error;
};

// Check only child edges: normal ASTs deliberately contain parent/prev cycles.
// This also protects public APIs accepting ASTs without passing through parse().
const assertAstDepth = (ast) => {
  const pending = [{ node: ast, depth: 0 }];
  const seen = new Set();
  while (pending.length) {
    const { node, depth } = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (depth > MAX_AST_DEPTH || seen.has(node) || seen.size >= MAX_AST_NODES) {
      throw depthError();
    }
    seen.add(node);
    if (Array.isArray(node.nodes)) {
      if (node.nodes.length > MAX_AST_NODES || pending.length + node.nodes.length > MAX_AST_NODES) {
        throw depthError();
      }
      for (const child of node.nodes) pending.push({ node: child, depth: depth + 1 });
    }
  }
};

exports.assertParserDepth = (stack) => {
  if (stack.length > MAX_NESTING) throw depthError();
};
exports.assertAstDepth = assertAstDepth;
