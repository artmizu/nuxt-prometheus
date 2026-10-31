import { register } from '@prometheus-io/client'
import { useRuntimeConfig } from 'nitropack/runtime'

export default async function metricsHandler() {
  const params = useRuntimeConfig().public.prometheus

  if (!params.metricsEndpoint)
    return new Response('Not Found', { status: 404 })

  return new Response(await register.metrics(), {
    headers: { 'Content-Type': register.contentType },
  })
}
