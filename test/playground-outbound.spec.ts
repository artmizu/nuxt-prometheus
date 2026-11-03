import { fileURLToPath } from 'node:url'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

interface UpstreamResponse {
  ok: boolean
  elapsedMs: number
  body: { message: string, path?: string }
}

interface GrpcResponse {
  ok: boolean
  elapsedMs: number
  response?: { message: string }
  error?: string
}

interface CallShapeResponse {
  optionsFirst: { argCount: number, isUrl: boolean, marker: boolean }
  urlFirst: { argCount: number, isUrl: boolean, marker: boolean }
}

describe('playground outbound cases', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../playground', import.meta.url)),
    browser: false,
  })

  it('completes a fetch request', async () => {
    const result = await $fetch<UpstreamResponse>('/api/outbound/fetch')

    expect(result.ok).toBe(true)
    expect(result.body.message).toBe('http upstream')
    expect(result.elapsedMs).toBeGreaterThanOrEqual(20)
  })

  it('completes an http request', async () => {
    const result = await $fetch<UpstreamResponse>('/api/outbound/http')

    expect(result.ok).toBe(true)
    expect(result.body.message).toBe('http upstream')
    expect(result.elapsedMs).toBeGreaterThanOrEqual(20)
  })

  it('completes an http2 request', async () => {
    const result = await $fetch<{ ok: boolean, elapsedMs: number, body: string }>('/api/outbound/http2')

    expect(result.ok).toBe(true)
    expect(result.body).toBe('http2 upstream')
    expect(result.elapsedMs).toBeGreaterThanOrEqual(20)
  })

  it('completes a grpc call', async () => {
    const result = await $fetch<GrpcResponse>('/api/outbound/grpc')

    expect(result).toMatchObject({
      ok: true,
      response: { message: 'hello world' },
    })
    expect(result.elapsedMs).toBeGreaterThanOrEqual(20)
  })

  it('preserves the caller argument shape for downstream patches', async () => {
    const result = await $fetch<CallShapeResponse>('/api/outbound/call-shape')

    expect(result.optionsFirst).toEqual({ argCount: 2, isUrl: false, marker: true })
    expect(result.urlFirst).toEqual({ argCount: 3, isUrl: true, marker: false })
  })

  it('renders every case during ssr', async () => {
    const html = await $fetch<string>('/outbound')

    expect(html).toContain('outbound cases')
    expect(html).toContain('http2 upstream')
    expect(html).toContain('hello world')
    expect(html).toContain('&quot;argCount&quot;: 2')
  })

  it('exports request timings for collected calls', async () => {
    await $fetch('/api/outbound/fetch')
    await $fetch('/api/outbound/http')
    await $fetch('/api/outbound/http2')
    await $fetch('/api/outbound/grpc')

    const metrics = await $fetch<string>('/metrics')

    expect(metrics).toMatch(/playground_page_request_time\{path="\/api\/outbound\/fetch",status_code="200"\} [1-9]\d*/)
    expect(metrics).toMatch(/playground_page_request_time\{path="\/api\/outbound\/http",status_code="200"\} [1-9]\d*/)
    expect(metrics).toMatch(/playground_page_request_time\{path="\/api\/outbound\/http2",status_code="200"\} [1-9]\d*/)
    expect(metrics).toMatch(/playground_page_request_time\{path="\/api\/outbound\/grpc",status_code="200"\} [1-9]\d*/)
  })
})
