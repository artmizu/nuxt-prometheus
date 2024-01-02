export default defineNuxtConfig({
  modules: [
    '../src/module',
  ],

  prometheus: {
    prefix: 'playground_',
  },
})
