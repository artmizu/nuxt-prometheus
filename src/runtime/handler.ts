import { defineEventHandler } from 'h3'

import { AggregatorRegistry, register } from 'prom-client'

import { useRuntimeConfig } from '#app'

export default defineEventHandler(async (event) => {
  try {
    const params = useRuntimeConfig().public.prometheus

    const allMetrics = await register.getMetricsAsJSON()

    if (params.prefix) {
      allMetrics.map((m) => {
        return {
          ...m,
          name: `${params.prefix}${m.name}`,
        }
      })
    }

    const aggrRegistry = AggregatorRegistry.aggregate(allMetrics)

    const data = await aggrRegistry.metrics()

    console.log('got data:', data)

    event.res.setHeader('Content-Type', register.contentType)
    event.res.end(data)
  }
  catch (e) {
    event.res.statusCode = 500
    event.res.end(e)
  }
})
