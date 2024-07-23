export default defineNuxtConfig({
  modules: [
    '@artmizu/nuxt-prometheus',
  ],

  prometheus: {
    prefix: 'playground_',
  },

  compatibilityDate: '2024-07-23',
})
