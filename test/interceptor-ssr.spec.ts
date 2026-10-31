import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { $fetch, setup, useTestContext } from '@nuxt/test-utils/e2e'
import { afterAll, describe, expect, it } from 'vitest'

describe('interceptor SSR attribution', async () => {
  let requests = 0
  const upstream = createServer((_req, res) => {
    requests++
    setTimeout(() => res.end('local upstream response'), 25)
  })
  await new Promise<void>((resolve) => {
    upstream.listen(0, '127.0.0.1', resolve)
  })
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
      runtimeConfig: { upstream: `http://127.0.0.1:${address.port}` },
    },
  })

  it('measures outbound SSR requests across reused connections', async () => {
    for (let i = 0; i < 2; i++) {
      const before = requests
      const response = await fetch(new URL('/', useTestContext().url!))
      const content = await response.text()
      expect(response.status, content).toBe(200)
      expect(content).toContain('local upstream response')
      expect(requests).toBeGreaterThan(before)
      const metrics = await $fetch<string>('/metrics')

      expect(metrics).toMatch(/page_request_time\{path="\/"\} [1-9]\d*/)
      expect(metrics).toMatch(/page_request_time_histogram_count\{path="\/"\} [1-9]\d*/)
    }
  })
})
