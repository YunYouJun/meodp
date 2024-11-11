# MEODP (Mystic Eyes of Death Perception)

Written by Typescript, based on [Playwright](https://playwright.dev/).

## Usage

You can use it like a lib or a cli.

Or like an application:

```ts
// Create a config file: `meodp.config.ts` in your project root.
import { defineConfig } from 'meodp'

export default defineConfig({

})
```

## Ref

- [lychee](https://lychee.cli.rs/)

## Logs

```bash
logs/meodp
```

## FAQ

### 与 lychee 的区别

lychee 是一个使用 Rust 编写的快速检测链接的命令行。
它的命令行应该能满足你使用命令行的大部分需求。

但我希望能够通过脚本/配置自由地定制检测流程、日志，并记录相关内容，执行对应的函数。
因此我们需要一个类似 SDK 的库，来实现类似的功能。
同时基于 Typescript 可以获得更好的开发灵活性，而使用 Playwright 则可以模拟浏览器以检测页面中的资源加载。

如果可能，它未来也许可以支持插件或预置配置。
