import type { NitroApp, NitroRuntimeHooks } from 'nitropack/types'
import { createHooks } from 'hookable'

export type RequestEvent = Parameters<NitroRuntimeHooks['request']>[0]
export type NitroHooks = ReturnType<typeof createHooks<NitroRuntimeHooks>>

export function startNitroPlugin(plugin: (app: NitroApp) => void) {
  const hooks = createHooks<NitroRuntimeHooks>()
  plugin({ hooks } as unknown as NitroApp)
  return hooks
}

export function createRequestEvent(): RequestEvent {
  return { context: {} } as unknown as RequestEvent
}
