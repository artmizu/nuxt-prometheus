import { defu } from 'defu'
import { addPlugin, addServerHandler, createResolver, defineNuxtModule } from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'
import { collectDefaultMetrics, register } from 'prom-client'

import { name, version } from '../package.json'
import type { AnalyticsModuleParams } from './runtime/type'

interface RuntimeConfig {
  prometheus: Partial<AnalyticsModuleParams>
}

export interface ModuleOptions extends AnalyticsModuleParams { }
export interface ModulePublicRuntimeConfig extends RuntimeConfig { }

// immediate return via export default brings the build errors
const module: NuxtModule<Partial<AnalyticsModuleParams>> = defineNuxtModule<Partial<AnalyticsModuleParams>>({
  meta: {
    name,
    version,
    configKey: 'prometheus',
    compatibility: {
      nuxt: '^3.0.0 || ^2.16.0',
      bridge: true,
    },
  },
  defaults: {
    verbose: true,
    healthCheck: true,
    prometheusPath: '/metrics',
    healthCheckPath: '/health',
  },
  async setup(options, nuxt) {
    const moduleOptions: Partial<AnalyticsModuleParams> = defu(
      nuxt.options.runtimeConfig.public.prometheus as any, // TODO
      options,
    )
    nuxt.options.runtimeConfig.public.prometheus = moduleOptions

    
    console.log('setup server', moduleOptions)
    // collectDefaultMetrics({
    //   prefix: moduleOptions.prefix,
    //   register,
    // })

    const { resolve } = createResolver(import.meta.url)
    nuxt.options.build.transpile.push(resolve('runtime'))

    addServerHandler({
      route: options.prometheusPath,
      method: 'get',
      handler: resolve('./runtime/handler'),
    })

    if (options.healthCheck) {
      addServerHandler({
        route: options.healthCheckPath,
        method: 'get',
        handler: resolve('./runtime/health'),
      })
    }

    addPlugin({ src: resolve('./runtime/plugin'), mode: 'server' })
  },
})

export default module
