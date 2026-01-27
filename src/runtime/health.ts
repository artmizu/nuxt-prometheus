import { createError, defineEventHandler } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'

export default defineEventHandler(() => {
  const params = useRuntimeConfig().public.prometheus

  if (!params.healthCheck) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
    })
  }

  return 'ok'
})
