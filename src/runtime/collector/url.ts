import type { OutgoingHttpHeaders } from 'node:http2'

interface ClientRequestUrlSource {
  protocol?: string
  host?: string
  path?: string
  getHeader?: (name: string) => unknown
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

  if (target && typeof target === 'object') {
    const options = target as { host?: string, hostname?: string, port?: number | string, protocol?: string }
    const host = options.hostname ?? options.host
    if (host) {
      const authority = host.includes(':') || options.port === undefined
        ? host
        : `${host}:${options.port}`
      return `${options.protocol ?? request.protocol ?? 'http:'}//${authority}${request.path ?? ''}`
    }
  }

  return `${request.protocol ?? 'http:'}//${request.host ?? 'localhost'}${request.path ?? ''}`
}

export function streamRequestUrl(headers: OutgoingHttpHeaders | undefined) {
  return `${headers?.[':scheme'] ?? 'http'}://${headers?.[':authority'] ?? 'localhost'}${headers?.[':path'] ?? ''}`
}
