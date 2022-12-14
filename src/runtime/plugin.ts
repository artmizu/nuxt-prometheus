import { BatchInterceptor } from '@mswjs/interceptors'
import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/lib/interceptors/XMLHttpRequest'
import { ClientRequestInterceptor } from '@mswjs/interceptors/lib/interceptors/ClientRequest'
import { logger } from '@nuxt/kit'
import { renderTime, requestTime, totalTime } from './registry'
import type { AnalyticsModuleState } from './type'
import { calculateTime } from './utils'
import { defineNuxtPlugin, useRouter, useRuntimeConfig } from '#app'

export default defineNuxtPlugin((ctx) => {
  const params = useRuntimeConfig().public.analytics
  const router = useRouter()
  const path = router.currentRoute.value.path === '' ? '/' : router.currentRoute.value.path
  const name = router.currentRoute.value.name
  const interceptor = new BatchInterceptor({
    name: 'nuxt-analytics',
    interceptors: [
      new XMLHttpRequestInterceptor(),
      new ClientRequestInterceptor(),
    ],
  })
  interceptor.apply()
  const state: AnalyticsModuleState = {
    start: Date.now(),
    path: `${String(name)}: ${path}`,
    requests: {},
    interceptor,
  }

  ctx.hook('app:rendered', () => {
    state.interceptor?.dispose()
    const time = calculateTime(state)
    renderTime.labels(state.path).set(time.render)
    requestTime.labels(state.path).set(time.request)
    totalTime.labels(state.path).set(time.total)
    if (params.verbose) {
      logger.info('[analytics] api request time:', time.request)
      logger.info('[analytics] render time:', time.render)
      logger.info('[analytics] total time:', time.total)
    }
  })

  interceptor.on('request', (req) => {
    state.requests[req.url] = {
      start: Date.now(),
      end: Date.now(),
    }

    if (params.verbose)
      logger.info(`[analytics] request: ${req.url}, ${new Date().toISOString()}`)
  })

  interceptor.on('response', (_, res) => {
    if (state.requests[res.url])
      state.requests[res.url].end = Date.now()
  })
})
