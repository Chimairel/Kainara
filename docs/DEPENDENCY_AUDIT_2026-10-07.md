# Dependency audit and compatible repairs — October 7, 2026

**Follow-up status:** CHG-20261007-04 repairs the remaining tooling findings described below. The earlier sections preserve the initial diagnosis and three-patch result. Current full root/backend/frontend registry audits report zero findings; the local brace fork is verified separately by mandatory regression tests and source comparison, because registry advisory scanning does not review local source.

## CI failure diagnosis

The owner supplied backend/frontend GitHub Actions logs for run 37498895048. Both jobs stopped at `npm audit`; their later lint, test and build steps were skipped. The separate green browser/container jobs do not establish that these skipped checks passed. CI runs on every pushed branch, including development and demo, so each failing run can produce another GitHub email.

A fresh local audit reproduced the dependency failures: one backend critical affected package and eleven frontend affected packages. Package counts include dependency cascades; the frontend had four underlying advisories, rather than eleven independent application defects. Advisory publication and updates on October 5–6 explain new findings at unchanged application code. No evidence of an actual compromise was obtained or inferred.

## Compatible repairs

Only existing dependency resolutions changed; package manifests, application logic and CI gates are unchanged.

| Package | Previous | Patched | Advisory |
| --- | --- | --- | --- |
| Backend `proxy-addr` | 2.0.7 | 2.0.8 | [IPv4-mapped IPv6 trust subnet spoofing](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) |
| Frontend `sharp` and platform binaries | 0.35.4 | 0.35.5 | [Upstream librsvg vulnerability](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) |
| Frontend `source-map-js` | 1.2.1 | 1.2.2 | [Indexed source-map offsets denial of service](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) |

These versions fit the existing parent dependency ranges. Sharp's bundled libvips packages move from 1.3.3 to 1.3.4. The backend uses a numeric one-hop trust-proxy setting, rather than the advisory's malformed subnet configuration; patching the package still removes the affected resolution. This configuration observation is not a general proxy-security certification.

## Remaining frontend tooling findings

- [`braces` GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched version. The current latest registry version is 3.0.3. It reaches Tailwind CSS 3.4.19 and Next ESLint tooling through `micromatch`, `fast-glob` and `chokidar`.
- [`postcss-selector-parser` GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) is patched in 7.1.6, outside Tailwind 3 and `postcss-nested` 6's declared parser major range. The latest parser 6 release remains 6.1.4.
- After compatible repairs, the full frontend audit reports nine affected packages: seven high and two moderate, all traced to these two advisories. Production-only frontend audit reports zero. Root and full backend audits report zero.

The remaining findings need a separately scoped tooling migration or an upstream compatible fix. A Tailwind 4 migration alone does not remove Next ESLint's glob dependency. Do not run `npm audit fix --force`: its proposals include major tool changes and an ESLint-config downgrade. Do not disable `npm audit`, omit development dependencies from the existing gate, fabricate a patched version, or claim a green full frontend audit. Under the unchanged workflow, frontend CI can still fail and generate email.

## Verification

Verification results are recorded in engineering change CHG-20261007-03. Audits establish the resolved dependency state on this date, not universal security or a completed hosted deployment. Other tools' uncommitted work and owner services were preserved; no database operation was performed.

## Follow-up repair: complete tooling remediation (CHG-20261007-04)

- Pinned the existing transitive CSS selector parser to published 7.1.6. The upstream major change makes insertion during iteration safe; actual Tailwind 3 compilation was checked for compatibility. Generated stylesheet output before and after the dependency changes is exactly identical at 292,197 bytes, including scanning the current frontend source. Tailwind, Next.js and application components remain at their existing versions.
- Replaced the existing transitive `braces` implementation with a repository-maintained MIT-licensed depth-guard fork under `frontend/vendor/braces`. The direct local development dependency and `$braces` override ensure every existing consumer resolves that same implementation. No new third-party provider/package is adopted. The fork has a distinct local package identity and prerelease version; this is not a claim that upstream released a patch.
- Parsing rejects more than 100 nested brace/parenthesis blocks. Public compile/expand/stringify AST overloads validate child edges iteratively before recursive walkers, rejecting excessive depth, child cycles and excessive node count. Parent/previous links remain valid. Quoted, escaped and bracket-literal text is preserved. Upstream character/range limits remain. The recommendation comes from [upstream issue #70](https://github.com/micromatch/braces/issues/70).
- Preserved upstream copyright/license and original per-file SHA-256 provenance. Source changes are limited to the new guard and guard calls in parser/walkers. Upstream files retain their formatting under targeted Prettier exclusions; our guard and test runner are formatted normally.
- `npm test` now runs seven dependency-security Node tests before all Vitest application tests. These verify actual installed source matches the committed fork, consumer resolution, lockfile removal of registry braces, ordinary patterns/ranges, excessive string/AST nesting, cyclic ASTs, and long CSS selector parsing. A separate compatibility run passed 138 tests from seven upstream suites; tests needing a Bash executable were not claimed as exercised.
- Local directory dependencies need npm's `install-links=true` to install as self-contained packages with their dependencies. `.npmrc` records it; the frontend Dockerfile copies `.npmrc` and vendor source before `npm ci`. A clean Windows installation and Node 24/Linux Docker installation both passed registry audit and security regression checks. The final Linux check includes installed-source equality against the committed fork.
- Frontend lint, production build and 686 application tests across 148 files passed. Thirteen production-browser auth/public checks passed, including narrow/short-screen form geometry and input validation. Six additional desktop/mobile member banner cases passed with intercepted synthetic APIs. These do not exercise live Google/AI/email or clinical approvals. No backend application change or database operation was needed.
- Full root/backend/frontend registry audits report zero findings. CI retains its full `npm audit` gate and adds actual source regression evidence through the normal frontend test command. Audit scanning does not review the local fork; maintainers must preserve/review it and replace it with an upstream patch once every covered path is fixed. This is remediation of the known advisory, not a universal security certification.
