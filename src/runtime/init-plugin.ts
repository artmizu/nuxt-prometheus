import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin'
import { initMetrics } from './registry'
import { useRuntimeConfig } from '#imports'

/** A plugin to initialize metrics */
export default defineNitroPlugin(() => {
  const params = useRuntimeConfig().public.prometheus

  initMetrics(params)
})

