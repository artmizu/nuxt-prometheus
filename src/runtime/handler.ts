import { createError, defineEventHandler, setResponseHeader, setResponseStatus } from 'h3'
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
    setResponseHeader(event, 'Content-Type', register.contentType)
    return data
  }
  catch (e) {
    setResponseStatus(event, 500)
    return e
  }
})
