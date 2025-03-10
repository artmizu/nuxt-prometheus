export default defineNuxtConfig({
  modules: [
    '@artmizu/nuxt-prometheus',
  ],

  prometheus: {
    prefix: 'playground_',
    verbose: true,
  },

  compatibilityDate: '2024-11-07',
})
