import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { afterAll, describe, expect, it } from 'vitest'

describe('interception is disabled', async () => {
  let requests = 0
  const upstream = createServer((_req, res) => {
    requests++
    setTimeout(() => res.end('local upstream response'), 25)
  })
  await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve))
  afterAll(() => new Promise<void>((resolve, reject) => {
    upstream.close(error => error
      ? reject(error)
      : resolve())
  }))
  const address = upstream.address()
  if (!address || typeof address === 'string')
    throw new Error('Upstream did not bind a TCP port')

  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/interceptor', import.meta.url)),
    browser: false,
    nuxtConfig: {
      prometheus: { disableRequestInterceptor: true },
      runtimeConfig: { upstream: `http://127.0.0.1:${address.port}` },
    },
  })

  it('exports total timing but omits unavailable request and render metrics', async () => {
    const before = requests
    expect(await $fetch<string>('/')).toContain('local upstream response')
    expect(requests).toBeGreaterThan(before)
    expect(await $fetch<string>('/health')).toBe('ok')

    const metrics = await $fetch<string>('/metrics')
    expect(metrics).not.toContain('page_request_time')
    expect(metrics).not.toContain('page_render_time')
    expect(metrics).toMatch(/page_total_time\{path="\/",status_code="200"\} [1-9]\d*/)
    expect(metrics).toMatch(/page_total_time_histogram_sum\{path="\/",status_code="200"\} [1-9]\d*/)
    expect(metrics).toMatch(/page_total_time_histogram_count\{path="\/",status_code="200"\} [1-9]\d*/)
    expect(metrics).toContain('process_cpu_user_seconds_total')
  })
})
