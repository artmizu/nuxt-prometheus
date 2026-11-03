import { describe, expect, it } from 'vitest'
import { clientRequestUrl, streamRequestUrl } from '../src/runtime/collector/url'

describe('clientRequestUrl', () => {
  it('prefers the host header', () => {
    expect(clientRequestUrl({
      protocol: 'https:',
      host: 'example.com',
      path: '/p',
      getHeader: () => 'example.com:9090',
    })).toBe('https://example.com:9090/p')
  })

  it('uses a string target', () => {
    expect(clientRequestUrl({ protocol: 'http:', path: '/p' }, ['http://127.0.0.1:3000/base?q=1'])).toBe('http://127.0.0.1:3000/p')
  })

  it('uses a URL target', () => {
    expect(clientRequestUrl({ path: '/p' }, [
      new URL('http://127.0.0.1:3000/base'),
    ])).toBe('http://127.0.0.1:3000/p')
  })

  it('uses options with a hostname and port', () => {
    expect(clientRequestUrl({ path: '/p' }, [
      { hostname: '127.0.0.1', port: 3000 },
    ])).toBe('http://127.0.0.1:3000/p')
  })

  it('keeps a host that already has a port', () => {
    expect(clientRequestUrl({ path: '/p' }, [
      { host: '127.0.0.1:3000', port: 4000 },
    ])).toBe('http://127.0.0.1:3000/p')
  })

  it('adds brackets to an ipv6 host', () => {
    expect(clientRequestUrl({ path: '/p' }, [
      { hostname: '::1', port: 3000 },
    ])).toBe('http://[::1]:3000/p')
  })

  it('keeps a bracketed ipv6 host with a port', () => {
    expect(clientRequestUrl({ path: '/p' }, [
      { host: '[::1]:3000', port: 4000 },
    ])).toBe('http://[::1]:3000/p')
  })

  it('falls back to the request host', () => {
    expect(clientRequestUrl({ host: 'localhost', path: '/p' })).toBe('http://localhost/p')
  })
})

describe('streamRequestUrl', () => {
  it('uses the stream headers', () => {
    expect(streamRequestUrl({ ':scheme': 'https', ':authority': 'example.com:443', ':path': '/p' })).toBe('https://example.com:443/p')
  })

  it('falls back to the connect target', () => {
    expect(streamRequestUrl({ ':path': '/p' }, { scheme: 'http', authority: '127.0.0.1:3000' })).toBe('http://127.0.0.1:3000/p')
  })
})
