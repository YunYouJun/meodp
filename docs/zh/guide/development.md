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

::: details 验证范围
HTTP 与 sitemap 测试覆盖本地响应、跳转、访问受限、重试、超时、历史、报告校验、CLI 行为，以及 sitemap 格式、嵌套索引、gzip、循环和发现上限。`pnpm build` 验证 ESM、CommonJS 与类型声明产物。

发布前检查 `pnpm --filter meodp pack` 的包内容，确认包含 CLI 和类型声明，不包含工作区应用、测试及文档。文档修改后构建并预览两种语言，操作搜索与语言切换，检查桌面和移动端导航。浏览器验证不代表任意外部站点的可访问性。
:::
