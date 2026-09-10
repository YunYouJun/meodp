import { defineBuildConfig } from 'unbuild'
import pkg from './package.json'

export default defineBuildConfig({
  // If entries is not provided, will be automatically inferred from package.json
  entries: [
    'src/index',
    'src/cli/index',
    'src/cli/main',
    'src/check/index',
    'src/check/cli',
  ],

  // Generates .d.ts declaration file
  declaration: true,
  clean: true,

  externals: [
    ...Object.keys(pkg.dependencies || {}),
    'playwright',
  ],

  rollup: {
    dts: {
      tsconfig: 'tsconfig.json',
    },
    emitCJS: true,
    // inline cilicili
    inlineDependencies: true,
  },
})
