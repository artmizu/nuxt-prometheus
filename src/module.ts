import { addPlugin, addServerHandler, createResolver, defineNuxtModule } from '@nuxt/kit'
import { name, version } from '../package.json'
import type { AnalyticsModuleParams } from './runtime/type'

export interface ModuleOptions extends AnalyticsModuleParams { }
export interface ModulePublicRuntimeConfig extends AnalyticsModuleParams { }

// immediate return via export default brings the build errors
const module = defineNuxtModule<Partial<AnalyticsModuleParams>>({
  meta: {
    name,
    version,
    configKey: 'prometheus',
    compatibility: {
      nuxt: '^3.0.0',
    },
  },
  defaults: {
    verbose: true,
    healthCheck: true,
    prometheusPath: '/metrics',
    healthCheckPath: '/health',
  },
  async setup(options, nuxt) {
    nuxt.options.runtimeConfig.public.prometheus = options

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
