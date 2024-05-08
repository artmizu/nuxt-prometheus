export default defineNuxtConfig({
  modules: [
    '@artmizu/nuxt-prometheus',
  ],

  prometheus: {
    prefix: 'playground_',
  },
})
