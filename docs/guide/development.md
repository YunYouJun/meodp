# Development and verification

## Workspace layout

The repository follows the package boundaries in [starter-monorepo](https://github.com/YunYouJun/starter-monorepo):

```text
packages/meodp/   Published SDK, CLI, report viewer, and tests
apps/client/      Experimental Vitesse client
docs/            Private bilingual VitePress site
examples/app/    Private consumer using meodp through workspace:*
```

The root is private and owns shared lint rules, Git hooks, workspace configuration, and task shortcuts. Only `packages/meodp` is publishable. The report viewer is bundled into the library; it does not require the experimental client.

The migration retains pnpm 9, unbuild, the `meodp` package name, and its SDK imports. VitePress uses the stable 1.x line. Adopting the starter's structure does not require replacing the existing package build tool.

## Local commands

Use Node.js 22.19+ and the pnpm version declared in the root `packageManager` field.

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm docs:build
pnpm exec meodp --help
```

`test` and `build` target the published package. `typecheck` covers the package, documentation configuration, and Vue components. CI runs these checks and builds the documentation.

| Command                                            | Use                                                       |
| -------------------------------------------------- | --------------------------------------------------------- |
| `pnpm dev`                                         | Build the report viewer and stub the library with unbuild |
| `pnpm --filter meodp exec tsx bin/index.ts --help` | Run the CLI directly from source                          |
| `pnpm docs:dev`                                    | Start VitePress at `127.0.0.1`                            |
| `pnpm docs:preview`                                | Preview the built documentation                           |
| `pnpm dev:client`                                  | Start the experimental client                             |
| `pnpm demo`                                        | Run the legacy browser scanner with the example config    |
| `pnpm --filter meodp pack`                         | Build and package the npm artifact locally                |

`demo` and `test:e2e` use Playwright; install its browsers with `pnpm --filter meodp exec playwright install`. They are separate from the HTTP tests, which use local fixtures.

## Documentation workflow

Keep English pages under `docs/` and corresponding Chinese pages under `docs/zh/` with matching paths. The language switch then preserves the current page. Update both versions when behavior changes. API data declarations are imported directly from the package source.

The site includes local search, build-time dead-link checks, and a browser-only [Sitemap parser](../tools/sitemap). Its output is `docs/.vitepress/dist`, excluded from Git. `docs/competitive-analysis.md` remains a historical research note and is excluded from the published pages.

The default base is `/`. For hosting below a repository path, build with the desired prefix:

```bash
DOCS_BASE=/meodp/ pnpm docs:build
```

The [public documentation](https://yunyoujun.github.io/meodp/) is deployed by `docs.yml` on pushes to `main`, using `/meodp/` as its base. GitHub Pages must use GitHub Actions as its publishing source. Local builds and local commits do not deploy the site.

## Release to npm

The `release.yml` workflow publishes only `packages/meodp` when a GitHub Release is **published**. Ordinary pushes and draft releases do not publish. The release tag must equal `v` plus the package version. Stable versions use npm's `latest` tag; versions such as `0.2.0-beta.1` require a GitHub prerelease and use `next`.

Configure a GitHub Actions trusted publisher in the [npm package settings](https://www.npmjs.com/package/meodp/access):

| Field                | Value                                                       |
| -------------------- | ----------------------------------------------------------- |
| Organization or user | `YunYouJun`                                                 |
| Repository           | The current GitHub repository name, currently `meodp`       |
| Workflow filename    | `release.yml`                                               |
| Environment          | Leave empty; the workflow does not use a GitHub environment |
| Allowed actions      | Enable direct publishing with `npm publish`                 |

The workflow uses a GitHub-hosted runner, Node.js 24, npm 11.5.1+, and `id-token: write`. It needs no `NPM_TOKEN` secret; npm generates provenance automatically for public repositories and packages. The workflow file must exist on GitHub before configuring trust. If the repository is renamed, recreate the trusted publisher with the new name and update package repository metadata. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

Prepare a version locally:

```bash
pnpm release minor
pnpm install
```

`pnpm release <patch|minor|major|version>` only changes the package version. It does not commit, tag, push, or publish. Review and commit the change, push the release commit, then create a GitHub Release with the matching tag, for example `v0.2.0`. Publishing that release starts the workflow. Use a version that has not already been published to npm.

The workflow checks the release version, runs package tests and type checking, then calls `npm publish` inside `packages/meodp`; the package lifecycle scripts build its outputs. The first successful Actions run is required to verify the npm-side OIDC binding end to end.

::: details Verification coverage
The HTTP and sitemap tests cover local responses, redirects, restrictions, retries, timeouts, history, report validation, CLI behavior, sitemap formats, nested indexes, gzip, cycles, and discovery bounds. `pnpm build` checks the package's ESM, CommonJS, and declaration output.

`pnpm test:e2e` starts the docs at `127.0.0.1:4175` and runs Chromium, Firefox, and WebKit tests for the report viewer and Sitemap parser. Parser coverage includes file import and drag-and-drop, namespaces and CDATA, duplicates and invalid URLs, filtering and export, pagination, malformed XML, input limits, index references without network requests, and the English mobile layout. HTML reports are saved without automatically opening a server after failures.

Before release, inspect `pnpm --filter meodp pack` to confirm that the CLI and built declarations are included and workspace apps/tests/docs are excluded. For documentation changes, build and preview both languages, exercise search and language switching, and inspect desktop and mobile navigation. Browser checks do not establish the availability of arbitrary external sites.
:::
