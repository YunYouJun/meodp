# 开发与验证

## 工作区结构

仓库参考 [starter-monorepo](https://github.com/YunYouJun/starter-monorepo) 划分包边界：

```text
packages/meodp/   发布的 SDK、CLI、报告查看器与测试
apps/client/      实验性 Vitesse 客户端
docs/            私有的中英文 VitePress 文档站
examples/app/    通过 workspace:* 使用 meodp 的私有示例
```

根包为私有包，统一管理 lint、Git hooks、工作区配置及常用命令。只有 `packages/meodp` 用于发布。报告查看器打包在库内，不依赖实验性客户端。

迁移保留 pnpm 9、unbuild、`meodp` 包名及 SDK 导入方式，VitePress 使用稳定的 1.x 版本。采用模板的目录结构，不需要同时替换现有打包工具。

## 本地命令

使用 Node.js 22.19+，pnpm 版本以根目录 `packageManager` 字段为准。

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm docs:build
pnpm exec meodp --help
```

`test` 与 `build` 面向发布包，`typecheck` 覆盖发布包及文档配置。CI 会执行这些检查并构建文档。

| 命令                                               | 用途                                        |
| -------------------------------------------------- | ------------------------------------------- |
| `pnpm dev`                                         | 构建报告查看器，并用 unbuild 创建库的开发桩 |
| `pnpm --filter meodp exec tsx bin/index.ts --help` | 直接从源码运行 CLI                          |
| `pnpm docs:dev`                                    | 在 `127.0.0.1` 启动 VitePress               |
| `pnpm docs:preview`                                | 预览已构建文档                              |
| `pnpm dev:client`                                  | 启动实验性客户端                            |
| `pnpm demo`                                        | 使用示例配置运行旧版浏览器扫描器            |
| `pnpm --filter meodp pack`                         | 本地构建 npm 包产物                         |

`demo` 和 `test:e2e` 使用 Playwright，可通过 `pnpm --filter meodp exec playwright install` 安装浏览器。它们与使用本地测试服务器的 HTTP 测试分开运行。

## 文档工作流

英文页面位于 `docs/`，对应中文页面位于 `docs/zh/`，保持相同的相对路径以便切换语言时保留当前页面。行为变更时同步维护两种语言，API 数据声明直接引用包源码。

文档站包含本地搜索和构建时死链检查。产物目录 `docs/.vitepress/dist` 不纳入 Git。`docs/competitive-analysis.md` 保留为历史调研笔记，不参与文档站发布。

默认部署前缀为 `/`。部署到仓库子路径时，指定目标前缀构建：

```bash
DOCS_BASE=/mystic-eyes-of-death-perception/ pnpm docs:build
```

通过托管流程上传生成目录即可。构建文档或提交代码不会自动部署站点。

## 发布到 npm

`release.yml` 只在 GitHub Release **正式发布**时发布 `packages/meodp`，普通 push 和草稿 Release 不会触发。Release tag 必须等于 `v` 加包版本号。稳定版本使用 npm 的 `latest` 标签；例如 `0.2.0-beta.1` 必须对应 GitHub 预发布，并使用 `next` 标签。

在 [npm 包设置](https://www.npmjs.com/package/meodp/access) 中添加 GitHub Actions Trusted Publisher：

| 字段                 | 值                                                          |
| -------------------- | ----------------------------------------------------------- |
| Organization or user | `YunYouJun`                                                 |
| Repository           | GitHub 当前仓库名，目前为 `mystic-eyes-of-death-perception` |
| Workflow filename    | `release.yml`                                               |
| Environment          | 留空，工作流未使用 GitHub environment                       |
| Allowed actions      | 启用 `npm publish` 直接发布                                 |

工作流使用 GitHub 托管 runner、Node.js 24、npm 11.5.1+ 和 `id-token: write`，不需要 `NPM_TOKEN` secret。公开仓库发布公开包时，npm 自动生成 provenance。配置前需先将工作流文件推送到 GitHub。仓库改名后，应使用新名称重新建立 Trusted Publisher，并更新包的 repository 信息，详见 [npm Trusted Publishing 文档](https://docs.npmjs.com/trusted-publishers/)。

本地准备版本：

```bash
pnpm release minor
pnpm install
```

`pnpm release <patch|minor|major|version>` 只修改包版本，不会提交、打 tag、推送或发布。审阅并提交版本变更、推送发布提交后，再创建 tag 匹配的 GitHub Release，例如 `v0.2.0`。发布该 Release 才会启动工作流，版本号必须尚未在 npm 发布过。

工作流检查版本、运行包测试与类型检查，再在 `packages/meodp` 内执行 `npm publish`；包的生命周期脚本负责构建产物。npm 侧 OIDC 绑定是否正确，需要首次 Actions 发布成功后才能完成端到端确认。

::: details 验证范围
HTTP 与 sitemap 测试覆盖本地响应、跳转、访问受限、重试、超时、历史、报告校验、CLI 行为，以及 sitemap 格式、嵌套索引、gzip、循环和发现上限。`pnpm build` 验证 ESM、CommonJS 与类型声明产物。

发布前检查 `pnpm --filter meodp pack` 的包内容，确认包含 CLI 和类型声明，不包含工作区应用、测试及文档。文档修改后构建并预览两种语言，操作搜索与语言切换，检查桌面和移动端导航。浏览器验证不代表任意外部站点的可访问性。
:::
