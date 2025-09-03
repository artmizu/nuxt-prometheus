import { defineEventHandler, getRouterParams } from 'h3'

export default defineEventHandler((event) => {
  const params = getRouterParams(event)

  return {
    id: params.id,
  }
})
