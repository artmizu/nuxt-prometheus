import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin'
import { initMetrics } from './registry'
import { useRuntimeConfig } from '#imports'

export default defineNitroPlugin(() => {
    const params = useRuntimeConfig().public.prometheus

    console.log('define nitro plugin', params)

initMetrics(params)

})

