import { defineNuxtPlugin, useRouter, useRuntimeConfig } from '#app'

/**
 * This plugin is used to add the current vue router path to the nitro context,
 * because vue router is not available in the nitro context.
 */
export default defineNuxtPlugin((ctx) => {
  const params = useRuntimeConfig().public.prometheus

  if (!params.enabled)
    return

  const router = useRouter()
  const path = router.currentRoute.value?.matched?.[0]?.path

  ctx.ssrContext!.event.context.prometheus = {
    ...ctx.ssrContext!.event.context.prometheus,
    path,
  }
})
