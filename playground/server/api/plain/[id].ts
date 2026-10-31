import { getRouterParams } from 'h3'

export default function plainIdHandler(event: Parameters<typeof getRouterParams>[0]) {
  const params = getRouterParams(event)

  return {
    id: params.id,
  }
}
