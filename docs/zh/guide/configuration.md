# 项目配置与通知

从 meodp 0.2.0 开始，可以用 `meodp/config` 将 HTTP 检测、报告与通知集中到 `meodp.config.ts`。该轻量入口提供 TypeScript 类型，不会加载浏览器或邮件客户端。

```ts
// meodp.config.ts
import process from 'node:process'
import { defineConfig } from 'meodp/config'

export default defineConfig({
  check: {
    reporter: ['json', 'markdown', ['html', { outputFolder: 'reports/site' }]],
    input: 'public/links.yml',
    output: 'reports/links',
    history: '.cache/links.json',
    observer: 'ci',
    failOn: 'none',
  },
  report: {
    reporter: 'html',
    input: 'public/status/report.json',
    output: 'dist/status',
    verify: { url: 'https://example.com/status/report.json' },
  },
  notify: {
    input: 'reports/links/report.json',
    previousReport: 'public/status/report.json',
    title: '我的友链',
    failureThreshold: 2,
    reportUrl: 'https://example.com/status/',
    timeZone: 'Asia/Shanghai',
    feishu: {
      mode: 'off',
      transport: 'app',
      appId: process.env.FEISHU_APP_ID,
      appSecret: process.env.FEISHU_APP_SECRET,
      receiveId: process.env.FEISHU_RECEIVE_ID,
      receiveIdType: 'open_id',
    },
  },
})
```

```bash
meodp check
meodp check --timeout 15000 --fail-on unavailable
meodp report
meodp report --verify
meodp notify --channel feishu --mode changes --dry-run
```

## 配置规则

- `check`、`sitemap`、`report`、`notify` 默认读取当前目录的 `meodp.config.ts`，也可用 `--config path/to/meodp.config.ts` 指定文件。
- 优先级为：命令行参数 → 配置 → 内置默认值。配置中提供 `input` 后，可以省略对应命令的位置参数。
- 配置中的文件路径相对配置文件解析；命令行文件路径相对当前工作目录解析。Sitemap 输入仍为 HTTP(S) URL。
- `meodp`、`--help`、`--version` 不加载配置，也不发起检测。显式指定的配置不存在或加载抛错时返回退出码 `2`。
- 配置文件会执行受信任的项目代码。环境变量需要在配置中显式引用；HTTP 命令不会自动加载 `.env` 文件。
- 根入口 `meodp` 的 `defineConfig` 保留旧浏览器扫描器的数据结构。新的 HTTP 命令使用独立的 `meodp/config` 入口。

`check` 接收 [HTTP 检测选项](../reference/api#check-options)，以 `history` 文件替代内存中的 `previousReport`。`sitemap` 还支持 `discover`、`maxUrls` 等发现选项。`site` 可在检测完成后额外生成静态查看器；`report` 独立读取已有数据生成站点。

`report.input` 是 `meodp report` 读取的已有 JSON，`report.reporter` 是该命令的输出方式。上例读取发布快照，需由 CI 在检测完成后单独保存；若要直接串联检测与导出，将 `report.input` 设为 `reports/links/report.json`。通过顶层 `reporter` 或各命令的 `reporter` 选择输出格式，支持名称与 `[名称, 选项]` 元组。CLI 使用 `--reporter`，支持逗号分隔或重复传参；格式、路径选项和优先级详见[报告格式](./reports#reporters)。

## 历史与部署

`historySeed` 可指向已提交的报告，在新 CI 运行器缺少本地历史时恢复。无效历史会报错；检测环境不匹配默认报错，显式设置 `observerMismatch: 'reset'` 才会重新开始累计。本机和 CI 应使用不同的 observer 和历史文件。

```ts
import { defineConfig } from 'meodp/config'

export default defineConfig({
  check: {
    input: 'links.yml',
    history: '.cache/ci.json',
    historySeed: 'public/status/report.json',
    observer: 'github-actions-ubuntu',
    observerMismatch: 'reset',
  },
})
```

定时任务、附件保存、快照提交和静态托管部署由仓库 CI 编排。`meodp report --verify` 轮询 `report.verify.url`，直到线上 JSON 与 `report.input` 一致，且同目录页面包含 MEODP 查看器。默认尝试 12 次，间隔 15 秒，可通过 `attempts` 和 `delayMs` 调整。超时返回 `2`。

通知应放在部署验证通过后。比较基线必须是**本轮更新前**的快照：可以在独立通知任务中检出触发工作流的提交，或在覆盖快照前保存旧报告。拿本次报告与自身比较会抑制变化通知。

## 通知策略

每个通道独立设置 `mode`，默认 `off`，命令行 `--mode` 覆盖选中的通道。直接调用库函数 `createNotification()` 时默认使用 `changes`，无须通知时返回 `undefined`。

| 模式      | 行为                                                                 |
| --------- | -------------------------------------------------------------------- |
| `off`     | 在读取报告或使用凭证前跳过                                           |
| `changes` | 新增不可访问或访问限制、首次跨过连续失败阈值、恢复访问或解除访问限制 |
| `weekly`  | 每次调用都生成摘要，包含当前异常与恢复情况                           |

`weekly` 不创建定时任务。失败阈值默认是 2 次观测，不是持续宕机时间；超过阈值后相同异常不再触发 `changes` 通知。条目提供结构化类型 `unavailable`、`restricted`、`failure-threshold`、`recovered`、`restriction-lifted`。跨检测环境比较默认报错，除非显式设置 `notify.observerMismatch: 'reset'`。

```bash
# 预览内容，不需要凭证或发送消息；关闭的通道需要显式覆盖模式。
meodp notify --channel feishu --mode weekly --dry-run

# 预览明确标注的测试卡片，可使用已保存的历史快照。
meodp notify --channel feishu --test --dry-run

# 即使通道关闭也显式发送测试，需已配置凭证和收件人。
meodp notify --channel feishu --test
```

配置多个通道时，`--test` 必须同时指定 `--channel`。普通调用可选择一个通道，或按顺序处理全部通道；希望各通道发送失败互不影响时，使用独立 CI 任务。发送、预览或跳过返回 `0`，配置或投递错误返回 `2`。

## 投递与 API 复用

飞书卡片包含状态统计、观测时间、最多六项摘要和可选的报告 / 运行链接。`timeZone` 默认 `UTC`，`maxItems` 支持 1–6。应用模式获取 tenant token 后，可发送给 `open_id`（默认）、`user_id`、`union_id` 或 `email`。私聊请显式设置 `transport: 'app'`。适配器默认使用 `webhook`，接收飞书群自定义机器人的 `webhook`，以及可选签名 `secret` 和关键词 `keyword`。

邮件使用 `notify.email` 的 `host`、`port`、`user`、`password`、`from`、`to`。实际发邮件时再安装可选依赖 `pnpm add -D nodemailer@^10.0.3`；465 使用 TLS，587 强制 STARTTLS。预览不会加载 Nodemailer。凭证从环境变量读取，不将收件人 ID 或密钥写入受版本控制的文件。

API 将通知策略与投递分开：

```ts
import { readReport } from 'meodp/check'
import { createNotification } from 'meodp/notify'
import { createFeishuCard } from 'meodp/notify/feishu'

const report = await readReport('reports/links/report.json')
const previousReport = await readReport('public/status/report.json')
if (report) {
  const message = createNotification(report, { previousReport, title: '我的友链' })
  if (message)
    console.log(createFeishuCard(message, { timeZone: 'Asia/Shanghai' }))
}
```

投递使用 `meodp/notify/feishu` 的 `sendFeishuNotification(message, options)` 或 `meodp/notify/email` 的 `sendEmailNotification(message, options)`。`meodp/check` 还导出 `waitForReport(report, options)`。库函数不会自动读取项目配置或环境变量。
