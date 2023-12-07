import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'off',
    ],
  },
  overrides: [
    {
      files: ['test/**/*.ts'],
      rules: {
        'unicorn/prefer-dom-node-text-content': 'warning',
      },
    },
  ],
})
