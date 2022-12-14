import { defu } from 'defu'
import { addPlugin, addServerHandler, createResolver, defineNuxtModule, isNuxt2 } from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'
import { name, version } from '../package.json'
import type { AnalyticsModuleParams } from './runtime/type'

export interface ModuleOptions extends AnalyticsModuleParams { }
export interface ModulePublicRuntimeConfig extends AnalyticsModuleParams { }

// immediate return via export default brings the build errors
const module: NuxtModule<Partial<AnalyticsModuleParams>> = defineNuxtModule<Partial<AnalyticsModuleParams>>({
  meta: {
    name,
    version,
    configKey: 'analytics',
    compatibility: {
      nuxt: '^3.0.0',
    },
  },
  defaults: {
    verbose: true,
  },
  async setup(options, nuxt) {
    const moduleOptions: AnalyticsModuleParams = defu(
      nuxt.options.runtimeConfig.public.analytics,
      options,
    )
    nuxt.options.runtimeConfig.public.analytics = moduleOptions

    const { resolve } = createResolver(import.meta.url)
    nuxt.options.build.transpile.push(resolve('runtime'))

    addServerHandler({
      route: '/metrics',
      method: 'get',
      handler: resolve('./runtime/handler'),
    })

    addServerHandler({
      route: '/health',
      method: 'get',
      handler: resolve('./runtime/health'),
    })

    addPlugin({ src: resolve('./runtime/plugin'), mode: 'server' })
  },
})

export default module
