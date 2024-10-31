import { defineBuildConfig } from 'unbuild'
import pkg from './package.json'

export default defineBuildConfig({
  // If entries is not provided, will be automatically inferred from package.json
  entries: [
    'src/index',
    'src/cli/index',
  ],

  // Generates .d.ts declaration file
  declaration: true,
  clean: true,

  externals: [
    ...Object.keys(pkg.dependencies || {}),
    'playwright',
  ],

  rollup: {
    emitCJS: true,
    // inline cilicili
    inlineDependencies: true,
  },
})
