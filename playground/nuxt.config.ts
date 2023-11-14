import { defineNuxtConfig } from 'nuxt/config'
import MyModule from '../'

export default defineNuxtConfig({
  modules: [MyModule],

  prometheus: {
    prefix: 'nuxt_ssr_',
  },
})
