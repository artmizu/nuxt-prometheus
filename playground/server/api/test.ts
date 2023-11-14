import { defineEventHandler } from "h3"

import { useRuntimeConfig } from "../../.nuxt/imports"

export default defineEventHandler((event) => {

  const runtimeConfig = useRuntimeConfig()

console.log('runtimeConfig:', runtimeConfig)

  return `Hello: ${runtimeConfig}`
})
