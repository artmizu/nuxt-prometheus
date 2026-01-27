import { createError, defineEventHandler } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { register } from 'prom-client'

export default defineEventHandler(async (event) => {
  const params = useRuntimeConfig().public.prometheus

  if (!params.metricsEndpoint) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
    })
  }

  try {
    const data = await register.metrics()
    event.res.setHeader('Content-Type', register.contentType)
    event.res.end(data)
  }
  catch (e) {
    event.res.statusCode = 500
    event.res.end(e)
  }
})
