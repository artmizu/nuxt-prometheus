import type { OutgoingHttpHeaders } from 'node:http2'

interface ClientRequestUrlSource {
  protocol?: string
  host?: string
  path?: string
  getHeader?: (name: string) => unknown
}

interface RequestOptionsLike {
  host?: string
  hostname?: string
  port?: number | string
  protocol?: string
}

interface StreamTarget {
  scheme?: string
  authority?: string
}

function isRequestOptions(value: unknown): value is RequestOptionsLike {
  return typeof value === 'object' && value !== null
}

function formatAuthority(host: string, port?: number | string) {
  const bracketed = host.startsWith('[')
  const colonCount = host.split(':').length - 1
  const hasPort = bracketed
    ? host.includes(']:')
    : colonCount === 1
  if (hasPort)
    return host

  const hostname = colonCount > 1
    ? `[${host}]`
    : host
  return port === undefined
    ? hostname
    : `${hostname}:${port}`
}

export function clientRequestUrl(request: ClientRequestUrlSource, args: readonly unknown[] = []) {
  const hostHeader = request.getHeader?.('host')
  if (typeof hostHeader === 'string' && hostHeader.length > 0)
    return `${request.protocol ?? 'http:'}//${hostHeader}${request.path ?? ''}`

  const target = args[0]
  if (typeof target === 'string' || target instanceof URL) {
    const url = new URL(target)
    return `${url.protocol}//${url.host}${request.path ?? `${url.pathname}${url.search}`}`
  }

  if (isRequestOptions(target)) {
    const host = target.hostname ?? target.host
    if (host)
      return `${target.protocol ?? request.protocol ?? 'http:'}//${formatAuthority(host, target.port)}${request.path ?? ''}`
  }

  return `${request.protocol ?? 'http:'}//${request.host ?? 'localhost'}${request.path ?? ''}`
}

export function streamRequestUrl(headers: OutgoingHttpHeaders | undefined, target?: StreamTarget) {
  return `${headers?.[':scheme'] ?? target?.scheme ?? 'http'}://${headers?.[':authority'] ?? target?.authority ?? 'localhost'}${headers?.[':path'] ?? ''}`
}
