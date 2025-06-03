export default defineNuxtConfig({
  modules: [
    '@artmizu/nuxt-prometheus',
  ],

  prometheus: {
    prefix: 'playground_',
    // clusterPort: 9100,
  },
  // nitro: {
  //   preset: 'node-cluster',
  //   options: {
  //     cluster: {
  //       workers: '1' // or a specific number
  //     }
  //   }
  // }
})
