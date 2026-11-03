import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    '@typescript-eslint/no-unused-vars': 'off',
  },
  ignores: [
    'dist',
    'node_modules',
  ],
}, {
  files: ['k6/**/*.js'],
  languageOptions: {
    globals: { __ENV: 'readonly' },
  },
}, {
  files: ['test/runtime/**/*.mjs'],
  rules: {
    'antfu/no-import-dist': 'off',
    'no-console': 'off',
  },
})
