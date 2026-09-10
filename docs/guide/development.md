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

`test` and `build` target the published package. `typecheck` covers the package and documentation configuration. CI runs these checks and builds the documentation.

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

The site includes local search and build-time dead-link checks. Its output is `docs/.vitepress/dist`, excluded from Git. `docs/competitive-analysis.md` remains a historical research note and is excluded from the published pages.

The default base is `/`. For hosting below a repository path, build with the desired prefix:

```bash
DOCS_BASE=/mystic-eyes-of-death-perception/ pnpm docs:build
```

Upload the generated directory through your hosting workflow. Building documentation or committing changes does not deploy the site.

::: details Verification coverage
The HTTP and sitemap tests cover local responses, redirects, restrictions, retries, timeouts, history, report validation, CLI behavior, sitemap formats, nested indexes, gzip, cycles, and discovery bounds. `pnpm build` checks the package's ESM, CommonJS, and declaration output.

Before release, inspect `pnpm --filter meodp pack` to confirm that the CLI and built declarations are included and workspace apps/tests/docs are excluded. For documentation changes, build and preview both languages, exercise search and language switching, and inspect desktop and mobile navigation. Browser checks do not establish the availability of arbitrary external sites.
:::
