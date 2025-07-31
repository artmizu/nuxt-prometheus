import { BatchInterceptor } from '@mswjs/interceptors'
import { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest'
import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest'
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import consola from 'consola'
import { initMetrics, metrics } from './registry'
import type { AnalyticsModuleState } from './type'
import { calculateTime } from './utils'
import { defineNuxtPlugin, useRouter, useRuntimeConfig } from '#app'

const interceptor = new BatchInterceptor({
  name: 'nuxt-prometheus',
  interceptors: [
    new XMLHttpRequestInterceptor(),
    new ClientRequestInterceptor(),
    new FetchInterceptor(),
  ],
})

export default defineNuxtPlugin((ctx) => {
  const params = useRuntimeConfig().public.prometheus
  const router = useRouter()

  if (!params.disableRequestInterceptor)
    interceptor.apply()

  initMetrics(params)

  const path = router.currentRoute.value?.matched?.[0]?.path || 'empty'
  const name = router.currentRoute.value?.name || 'empty'

  const state: AnalyticsModuleState = {
    start: Date.now(),
    path: `${String(name)}: ${path}`,
    requests: {},
  }

  function onRequest({ request }: { request: Request }) {
    const url = new URL(request.url)

    /**
     * Exclude Nuxt requests to parts of the application, it's not about business-logic
     */
    const isNuxtRequest = /^\/__/.test(url.pathname)
    if (isNuxtRequest)
      return

    state.requests[request.url] = {
      start: Date.now(),
      end: Date.now(),
    }

    if (params.verbose)
      consola.info(`[nuxt-prometheus] request: ${request.url}, ${new Date().toISOString()}`)
  }

  function onResponse({ request, response }: { request: Request; response: Response }) {
    const url = request.url || response.url

    if (state.requests[url])
      state.requests[url].end = Date.now()

    if (params.verbose)
      consola.info(`[nuxt-prometheus] response: ${url}, ${new Date().toISOString()}`)
  }

  interceptor.on('request', onRequest)
  interceptor.on('response', onResponse)

  ctx.hooks.hookOnce('app:rendered', () => {
    interceptor.off('request', onRequest)
    interceptor.off('response', onResponse)

    const time = calculateTime(state)

    metrics.renderTime?.labels(state.path).set(time.render)
    metrics.requestTime?.labels(state.path).set(time.request)
    metrics.totalTime?.labels(state.path).set(time.total)

    metrics.renderTimeSummary?.labels(state.path).observe(time.render)
    metrics.requestTimeSummary?.labels(state.path).observe(time.request)
    metrics.totalTimeSummary?.labels(state.path).observe(time.total)

    if (params.verbose) {
      consola.info('[nuxt-prometheus] api request time:', time.request)
      consola.info('[nuxt-prometheus] render time:', time.render)
      consola.info('[nuxt-prometheus] total time:', time.total)
    }
  })
})
