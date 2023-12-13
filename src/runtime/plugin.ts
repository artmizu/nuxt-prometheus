import { BatchInterceptor } from '@mswjs/interceptors'
import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest'
import { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest'
import consola from 'consola'

import type { NuxtApp } from 'nuxt/app'
import { defineNuxtPlugin, useRouter, useRuntimeConfig } from 'nuxt/app'
import { renderTime, requestTime, totalTime, initMetrics, metrics } from './registry'

import type { AnalyticsModuleState } from './type'
import { calculateTime } from './utils'

export default defineNuxtPlugin((ctx: NuxtApp) => {
  const params = useRuntimeConfig().public.prometheus
  const router = useRouter()

  initMetrics(params)

  const path = router.currentRoute.value?.matched?.[0]?.path || 'empty'
  const name = router.currentRoute.value?.name || 'empty'
  const interceptor = new BatchInterceptor({
    name: 'nuxt-prometheus',
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

    metrics.renderTime?.labels(state.path).set(time.render)
    metrics.requestTime?.labels(state.path).set(time.request)
    metrics.totalTime?.labels(state.path).set(time.total)
    if (params.verbose) {
      consola.info('[nuxt-prometheus] api request time:', time.request)
      consola.info('[nuxt-prometheus] render time:', time.render)
      consola.info('[nuxt-prometheus] total time:', time.total)
    }
  })

  interceptor.on('request', (req) => {
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

  interceptor.on('response', (res) => {
    if (state.requests[res.request.url])
      state.requests[res.request.url].end = Date.now()
  })
})
