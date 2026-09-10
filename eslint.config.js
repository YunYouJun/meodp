import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  unocss: true,
  vue: true,

  rules: {
    'no-console': 'off',
  },
}, {
  files: ['packages/meodp/test/check.test.ts', 'packages/meodp/test/sitemap.test.ts'],
  rules: {
    'test/no-import-node-test': 'off',
  },
})
