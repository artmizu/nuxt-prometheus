import { defineNuxtConfig } from 'nuxt/config'
import MyModule from '../src/module'

export default defineNuxtConfig({
  modules: [
    MyModule,
  ],

  prometheus: {
    prefix: 'playground_',
  },
})
