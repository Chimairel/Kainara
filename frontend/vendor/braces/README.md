# Repository-maintained brace depth guard

This is a local fork of MIT-licensed `braces` 3.0.3, replacing the existing transitive dependency through npm overrides. It is **not an upstream patched release**. Its package identity is `@nutrimind/braces-depth-guard`, version `3.0.3-nutrimind.1`; it must never be published as an upstream release.

Upstream: <https://github.com/micromatch/braces/tree/3.0.3>. The unmodified source hashes are in `upstream.json`; copyright and MIT terms are retained in `LICENSE`.

## Security changes

[Upstream issue #70](https://github.com/micromatch/braces/issues/70) recommends limiting parse nesting before recursive tree walkers. This fork rejects more than 100 nested brace/parenthesis blocks with a controlled `SyntaxError` and `BRACES_DEPTH_LIMIT` code. Quoted, escaped and bracket-literal delimiters retain upstream parsing behavior. Caller options cannot disable the bound.

Public AST overloads can bypass string parsing, so compile/expand/stringify additionally validate child edges with an iterative traversal. This rejects excessive depth, child-edge cycles and excessive node counts before calling recursive walkers. Normal parent/previous links are ignored.

The upstream character and range expansion limits remain unchanged. This is a targeted repair of the recorded recursion issue, not a general guarantee against every resource-exhaustion pattern.

## Verification and maintenance

`npm test` runs the dependency-security regression tests before the application tests. These verify actual installed consumer resolution, ordinary glob/range behavior, the published excessive-depth shapes, AST bypasses and parser performance. `npm audit` remains enabled for all registry dependencies. Registry advisory scanning does not review local fork source: these regression tests and source review provide the evidence for this patch.

Docker copies this directory before `npm ci`. Keep it within the frontend so Vercel's frontend root can install the same source. Remove the local override and this directory when a compatible upstream release repairs every covered path; rerun the security tests, exact generated-CSS comparison, lint, application tests, build and browser checks before doing so.
