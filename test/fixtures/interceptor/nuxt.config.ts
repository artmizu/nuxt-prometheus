export default defineNuxtConfig({
  srcDir: '.',
  modules: ['@artmizu/nuxt-prometheus'],
  prometheus: { verbose: false },
  runtimeConfig: { upstream: '' },
  compatibilityDate: '2025-01-01',
})
