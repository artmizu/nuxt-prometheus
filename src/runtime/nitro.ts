import type { NuxtPrometheusState } from './type'
import consola from 'consola'
import { defineNitroPlugin, useEvent, useRuntimeConfig } from 'nitropack/runtime'
import { bindInterceptor, interceptor, requestContext, setStateResolver } from './interceptor'
import { initMetrics, metrics } from './registry'
import { calculateTime } from './utils'

export default defineNitroPlugin((nitroApp) => {
  const params = useRuntimeConfig().public.prometheus

  if (!params.enabled)
    return

  if (!params.disableRequestInterceptor) {
    // Nitro's async context wraps the whole handler, including the SSR render,
    // so outbound requests fired during rendering are attributed correctly.
    setStateResolver(() => {
      try {
        const state = useEvent().context.prometheus as NuxtPrometheusState | undefined
        if (state)
          return state
      }
      catch {}
      return requestContext.getStore()
    })

    interceptor.apply()
    bindInterceptor({ verbose: params.verbose })
  }

  initMetrics(params)

  nitroApp.hooks.hook('request', (event) => {
    const state: NuxtPrometheusState = {
      start: Date.now(),
      requests: {},
    }
    event.context.prometheus = state
    // Fallback attribution for outbound requests that stay in this async context.
    requestContext.enterWith(state)
  })

  // Submit data after the response so it does not add latency to the request.
  nitroApp.hooks.hook('afterResponse', (event) => {
    const state = event.context.prometheus
    if (!state)
      return

    const path = event.context.matchedRoute?.path === '/**' ? state.path : event.context.matchedRoute?.path
    if (!path)
      return

    const time = calculateTime(state)

    metrics.renderTime?.labels(path).set(time.render)
    metrics.requestTime?.labels(path).set(time.request)
    metrics.totalTime?.labels(path).set(time.total)

    metrics.renderTimeSummary?.labels(path).observe(time.render)
    metrics.requestTimeSummary?.labels(path).observe(time.request)
    metrics.totalTimeSummary?.labels(path).observe(time.total)

    if (params.verbose) {
      consola.info(`[nuxt-prometheus] «${path}» api request time:`, time.request)
      consola.info(`[nuxt-prometheus] «${path}» render time:`, time.render)
      consola.info(`[nuxt-prometheus] «${path}» total time:`, time.total)
    }
  })
})
