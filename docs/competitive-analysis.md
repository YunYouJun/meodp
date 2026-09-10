# MEODP 竞品分析与继续投入判断

调研日期：2026-09-10。范围：官方文档、官方仓库源码和本项目代码的桌面调研；**未安装或实测竞品，未进行网站扫描、性能基准或用户需求验证**。下文区分已证实能力与推论；上游默认分支、文档及价格会变化，采用前应核对所选发行版本。

后续实施范围：本轮讨论已收敛为基于 linkinator 的通用 npm 检查模块、CLI 和报告，并以 friends 的友链维护作为首个接入场景。具体使用方式见当前 [README](../README.md)。下文“之前做过什么”记录的是改造前的状态；后续本地故障测试和 friends 首轮检查不属于本节最初的竞品桌面调研。

## 判断

**建议暂缓作为独立通用产品继续扩张，保留自用脚本或薄封装；是否调整项目状态由用户决定。** 当前证据能说明已有多种替代路径，不能说明 MEODP 完全没有价值或已被完整替代。

README 提出的“脚本配置、SDK、回调、日志”已经有现成工具覆盖；“真实浏览器检查”相对 HTTP 扫描有实际区别，但 Playwright、Crawlee、Screaming Frog 和 Checkly 已覆盖不同层次。值得验证的余地在于：针对自己维护的网站，以更少配置发现实际漏检的资源故障，并提供更少噪声、更易处理的结果。这是待验证假设，不是已成立的竞争优势。

## 之前做过什么

改造前仓库核查只找到 [README 的 lychee 参考与差异说明](https://github.com/YunYouJun/mystic-eyes-of-death-perception/blob/d28c957831831ebe7b1b67def1607061882c434e/README.md)，未找到此前独立、系统的竞品分析交付物。该说明是项目动机，尚不能作为市场空缺的证据。

项目已有 [Playwright 页面与资源检查](../packages/meodp/src/core/check/site.ts)、[网络事件采集](../packages/meodp/src/core/utils/assets.ts)、本地记录及 Markdown 输出；但 [前端首页](../apps/client/src/pages/index.vue) 仍是模板，[检查入口](../packages/meodp/src/core/check/index.ts) 的 sitemap 分支调用尚被注释，且 [CLI](../packages/meodp/src/cli/index.ts) 在运行结束后固定 `process.exit(0)`，不能直接视为可靠的 CI 失败门禁。当前更接近待完善的工具原型，不能把配置类型或 TODO 当作已经可用的功能。

## 竞品与替代方案

| 工具                            | 已证实能力与定位                                                                                                                                                                                                                                                                      | 对 MEODP 的覆盖与边界                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **lychee**                      | HTTP/文件链接检查；提供 CLI、Rust 库、GitHub Action，支持配置、缓存、重试、排除规则与 JSON/JUnit/Markdown 等输出。[官方仓库](https://github.com/lycheeverse/lychee)、[CLI 文档](https://lychee.cli.rs/guides/cli/)                                                                    | 已覆盖常规链接检查与自动化接入，也有库接口；其库面向 Rust，与希望直接使用 TS SDK 的诉求仍有区别。官方明确不运行浏览器引擎，因此不能等同于执行页面 JS 后的网络资源检查。[浏览器边界](https://github.com/lycheeverse/lychee#commandline-usage)                                                                                                                       |
| **linkinator**                  | TypeScript 实现的链接检查工具，提供 CLI 和 Node API；支持递归、结果对象、`pagestart`/`link` 事件、异步 `linksToSkip`、自定义请求头及 JSON/CSV 输出。[官方 README](https://github.com/JustinBeckwith/linkinator#api-usage)                                                             | 直接覆盖“JS/TS SDK + 回调 + 自定义流程”的主要动机，回调可接自己的日志/存储。当前核心路径为 HTTP HEAD/GET 加 HTML 流解析；锚点文档明确只检查服务端 HTML，不能据此声称它能捕获浏览器运行时动态请求。[请求实现](https://github.com/JustinBeckwith/linkinator/blob/main/src/index.ts)、[解析实现](https://github.com/JustinBeckwith/linkinator/blob/main/src/links.ts) |
| **Screaming Frog SEO Spider**   | 面向站点 SEO 审计的桌面爬虫，检查死链、错误和重定向；支持 Chromium 渲染后的 DOM、JS/CSS/图片资源检查，以及自定义 JavaScript。[渲染教程](https://www.screamingfrog.co.uk/seo-spider/tutorials/crawl-javascript-seo/)、[自定义 JS](https://www.screamingfrog.co.uk/blog/seo-spider-20/) | 浏览器渲染本身并非独有能力，完整站点审计已有产品。免费版每次最多 500 URL，JavaScript 渲染属于付费能力；官方价格页本次显示单用户 £199/年。其主要交付是 SEO 审计应用，不能直接等同于可嵌入的 TS SDK。[免费版边界](https://www.screamingfrog.co.uk/seo-spider/)、[价格](https://www.screamingfrog.co.uk/seo-spider/pricing/)                                          |
| **Checkly**                     | 持续合成监控；用 Playwright 在真实浏览器执行用户流程与断言，按计划运行，收集截图、日志并告警。[Browser Checks](https://www.checklyhq.com/docs/detect/synthetic-monitoring/browser-checks/overview/)、[检查调度](https://www.checklyhq.com/docs/concepts/checks/)                      | 覆盖浏览器脚本、执行记录和持续告警。产品重点是关键流程/端点监控；本次资料不足以把它认定为开箱即用的任意网站全站死链扫描器。即使有网络日志，也仍需定义什么情况应使检查失败。                                                                                                                                                                                        |
| **Crawlee / PlaywrightCrawler** | 通用开源 JS/TS 爬虫框架；提供 Playwright `page`、`requestHandler`、导航前后钩子、失败处理、重试及并发控制。[官方 API](https://crawlee.dev/js/api/playwright-crawler/interface/PlaywrightCrawlerOptions)、[官方仓库](https://github.com/apify/crawlee)                                 | 与“可定制的浏览器爬虫 SDK”最接近的构建替代。可以承接浏览器与爬取基础设施，但资源故障判定、忽略规则和面向人的报告仍需自己写；框架能力不等于现成死链产品。                                                                                                                                                                                                           |

这里实际存在三类需求，不能用同一个勾选表判定谁全面替代谁：**HTTP 静态扫描**检查可提取 URL 的可达性；**浏览器扫描**检查渲染后的链接和执行中产生的请求；**持续监控**还需要周期执行、保留历史及通知。工具能读取一个 JS 文件的 URL，不代表会执行它；工具能打开浏览器，也不代表会自动走遍登录、滚动和点击后才出现的状态。

## 对现有定位的影响

1. **SDK 和日志不构成充分差异。** linkinator 已提供 TS/Node API 与事件；把结果接入自己的回调、文件或数据库，通常可以在现有工具外完成。lychee 也并非完全不可编程。此判断来自上述接口能力，不是集成耗时的实测结论。
2. **浏览器资源检查有用，但不必自行维护整套产品。** Playwright 本身已有请求/响应事件、认证状态复用及 HTML/JSON/JUnit 报告；对少量关键页，可先直接写 Playwright Test。只有确实需要持续发现和遍历页面时，再评估 Crawlee 等爬取基础设施。[网络事件](https://playwright.dev/docs/network)、[认证](https://playwright.dev/docs/auth)、[报告](https://playwright.dev/docs/test-reporters)
3. **全站浏览器扫描有成本。** Screaming Frog 官方建议按需启用 JS 渲染，因为加载页面资源并构造 DOM 更慢、更耗资源。因此不能仅用“真实浏览器”推导更好的默认方案；该定性代价未在 MEODP 上量化。[官方说明](https://www.screamingfrog.co.uk/seo-spider/tutorials/crawl-javascript-seo/)

## 什么证据值得重新推进

先选自己真实维护的站点和曾发生的故障，将“现有 HTTP 检查工具 + 必要的 Playwright 测试”作为基线。用同一批样本比较：实际故障的漏检、需要人工处理的误报、结果能否定位到来源页面/资源，以及配置和长期维护成本。涉及浏览器交互的样本应明确所需登录、点击或滚动步骤，避免把未覆盖路径误认为已经检查。

如果常规工具或少量测试已经够用，就维持自用或停止增加范围；若反复出现现有组合难以处理、而薄封装能稳定解决的问题，再围绕该问题推进。当前未完成这一步验证，因此**不应把本次竞品文档标记成需求验证完成，也不应据此宣称具有性能、检出率或商业优势**。
