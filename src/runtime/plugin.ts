import { BatchInterceptor } from '@mswjs/interceptors'
import { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest'
import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest'
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import consola from 'consola'
import { initMetrics, metrics } from './registry'
import type { AnalyticsModuleState } from './type'
import { calculateTime } from './utils'
import { defineNuxtPlugin, useRouter, useRuntimeConfig } from '#app'

export default defineNuxtPlugin((ctx) => {
  const params = useRuntimeConfig().public.prometheus
  const router = useRouter()

  initMetrics(params)

  const path = router.currentRoute.value?.matched?.[0]?.path || 'empty'
  const name = router.currentRoute.value?.name || 'empty'

  const state: AnalyticsModuleState = {
    start: Date.now(),
    path: `${String(name)}: ${path}`,
    requests: {},
    interceptor: null,
  }

  state.interceptor = new BatchInterceptor({
    name: 'nuxt-prometheus',
    interceptors: [
      new XMLHttpRequestInterceptor(),
      new ClientRequestInterceptor(),
      new FetchInterceptor(),
    ],
  })

  state.interceptor.apply()

  state.interceptor.on('request', (req) => {
    const url = new URL(req.request.url)

    /**
     * Exclude Nuxt requests to parts of the application, it's not about business-logic
     */
    const isNuxtRequest = /^\/__/.test(url.pathname)
    if (isNuxtRequest)
      return

    state.requests[req.request.url] = {
      start: Date.now(),
      end: Date.now(),
    }

    if (params.verbose)
      consola.info(`[nuxt-prometheus] request: ${req.request.url}, ${new Date().toISOString()}`)
  })

  state.interceptor.on('response', ({ response }) => {
    if (state.requests[response.url])
      state.requests[response.url].end = Date.now()
  })

  ctx.hook('app:rendered', () => {
    state.interceptor?.dispose()
    const time = calculateTime(state)

    metrics.renderTime?.labels(state.path).set(time.render)
    metrics.requestTime?.labels(state.path).set(time.request)
    metrics.totalTime?.labels(state.path).set(time.total)
    if (params.verbose) {
      consola.info('[nuxt-prometheus] api request time:', time.request)
      consola.info('[nuxt-prometheus] render time:', time.render)
      consola.info('[nuxt-prometheus] total time:', time.total)
    }
  })
})
