import { defineEventHandler } from 'h3'

import { useRuntimeConfig } from '#imports'
import { AggregatorRegistry, register } from 'prom-client'

export default defineEventHandler(async (event) => {
  

  try {
    const params = useRuntimeConfig().public.prometheus

    console.log('get all metrics')

  //   // todo: error
    
    let allMetrics = await register.getMetricsAsJSON()

    console.log('line 13')

    if (params.prefix) {
      allMetrics = allMetrics.map((m) => {
        let m1 = {
          ...m,
          name: `${params.prefix}${m.name}`,
        }

        console.log('m1:', m1)

        return m1
      })
    }


    console.log('line 13 done', allMetrics)

    const aggrRegistry = AggregatorRegistry.aggregate([allMetrics])

    console.log('get metrics')

    const data = await aggrRegistry.metrics()

    console.log('got data:', data)

    event.res.setHeader('Content-Type', register.contentType)
    event.res.end(data)
  }
  catch (e) {
    console.log('error', e)

    event.res.statusCode = 500
    event.res.end(e)
  }
})
