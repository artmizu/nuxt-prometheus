import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    '@typescript-eslint/no-unused-vars': 'off',
  },
  ignores: [
    'dist',
    'node_modules',
  ],
})
