import { useRuntimeConfig } from 'nitropack/runtime'

export default function healthHandler() {
  const params = useRuntimeConfig().public.prometheus

  if (!params.healthCheck)
    return new Response('Not Found', { status: 404 })

  return 'ok'
}
