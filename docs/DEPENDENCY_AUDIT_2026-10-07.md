# Dependency audit and compatible repairs — October 7, 2026

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
