import { fileURLToPath } from 'node:url'
import { createPage, setup, useTestContext } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('module tests', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../playground', import.meta.url)),
  })

  it('health page check', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}health`)

    expect(await page.textContent('body')).toContain('ok')
  })

  it('node metrics check', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}metrics`)

    const content = await page.textContent('body')
    expect(content).toMatch(/^playground_process_start_time_seconds \d+/gm)
  })

  it('custom metrics check', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}a`)
    await page.goto(`${ctx.url}b`)
    await page.goto(`${ctx.url}metrics`)
    const content = await page.textContent('body')

    expect(content).toMatch(/page_render_time\{path="\/",status_code="200"\} \d+/g)
    expect(content).toMatch(/page_render_time\{path="\/a",status_code="200"\} \d+/g)
    expect(content).toMatch(/page_render_time\{path="\/b",status_code="200"\} \d+/g)

    expect(content).toMatch(/page_request_time\{path="\/",status_code="200"\} \d+/g)
    expect(content).toMatch(/page_request_time\{path="\/a",status_code="200"\} 0$/m)
    expect(content).toMatch(/page_request_time_histogram_sum\{path="\/a",status_code="200"\} 0$/m)
    expect(content).toMatch(/page_request_time\{path="\/b",status_code="200"\} \d+/g)

    expect(content).toMatch(/page_total_time\{path="\/",status_code="200"\} \d+/g)
    expect(content).toMatch(/page_total_time\{path="\/a",status_code="200"\} \d+/g)
    expect(content).toMatch(/page_total_time\{path="\/b",status_code="200"\} \d+/g)

    for (const metric of ['render', 'request', 'total']) {
      expect(content).toContain(`page_${metric}_time_histogram histogram`)
      for (const path of ['/', '/a', '/b'])
        expect(content).toMatch(new RegExp(`page_${metric}_time_histogram_count\\{path="${path}",status_code="200"\\} [1-9]\\d*`))
    }
    expect(content).not.toMatch(/page_(?:render|request|total)_time_summary/)
  })

  it('check the useFetch measuring time on /b route', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}b`)
    await page.goto(`${ctx.url}metrics`)
    const content = await page.textContent('body')

    expect(content).toMatch(/page_request_time\{path="\/b",status_code="200"\} [1-9]+/g)
  })

  it('check the native fetch measuring time on /c route', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}c`)
    await page.goto(`${ctx.url}metrics`)
    const content = await page.textContent('body')

    expect(content).toMatch(/page_request_time\{path="\/c",status_code="200"\} [1-9]+/g)
  })

  it('check nested page routes use the most specific matched route', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}posts`)
    await page.goto(`${ctx.url}posts/sample`)
    await page.goto(`${ctx.url}posts/sample/share`)
    await page.goto(`${ctx.url}metrics`)
    const content = await page.textContent('body')

    expect(content).toMatch(/page_render_time\{path="\/posts",status_code="200"\} \d+/g)
    expect(content).toMatch(/page_render_time\{path="\/posts\/:id\(\)",status_code="200"\} \d+/g)
    expect(content).toMatch(/page_render_time\{path="\/posts\/:id\(\)\/share",status_code="200"\} \d+/g)
  })

  it('check server route without external requests', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}api/plain`)
    await page.goto(`${ctx.url}api/plain/sample`)
    await page.goto(`${ctx.url}metrics`)
    const content = await page.textContent('body')

    expect(content).toMatch(/page_render_time\{path="\/api\/plain",status_code="200"\} \d+/g)
    expect(content).toMatch(/page_render_time\{path="\/api\/plain\/:id",status_code="200"\} \d+/g)
  })

  it('check server route with external requests', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}api/complex`)
    await page.goto(`${ctx.url}api/complex/sample`)
    await page.goto(`${ctx.url}metrics`)
    const content = await page.textContent('body')

    expect(content).toMatch(/page_render_time\{path="\/api\/complex",status_code="200"\} \d+/g)
    expect(content).toMatch(/page_render_time\{path="\/api\/complex\/:id",status_code="200"\} \d+/g)

    expect(content).toMatch(/page_request_time\{path="\/api\/complex",status_code="200"\} \d+/g)
    expect(content).toMatch(/page_request_time\{path="\/api\/complex\/:id",status_code="200"\} \d+/g)

    expect(content).toMatch(/page_total_time\{path="\/api\/complex",status_code="200"\} \d+/g)
    expect(content).toMatch(/page_total_time\{path="\/api\/complex\/:id",status_code="200"\} \d+/g)
  })

  it('records status_code="200" for direct page navigation', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}a`)
    await page.goto(`${ctx.url}metrics`)
    const content = await page.textContent('body')

    expect(content).toMatch(/page_total_time\{path="\/a",status_code="200"\} \d+/g)
    expect(content).toMatch(/page_total_time_histogram_count\{path="\/a",status_code="200"\} [1-9]\d*/g)
  })

  it('records real status code for non-200 responses', async () => {
    const ctx = useTestContext()
    const response = await fetch(new URL('/api/teapot', ctx.url!))
    expect(response.status).toBe(418)

    const page = await createPage('/')
    await page.goto(`${ctx.url}metrics`)
    const content = await page.textContent('body')

    expect(content).toMatch(/page_total_time\{path="\/api\/teapot",status_code="418"\} \d+/g)
    expect(content).toMatch(/page_total_time_histogram_count\{path="\/api\/teapot",status_code="418"\} [1-9]\d*/g)
    expect(content).not.toMatch(/page_total_time\{path="\/api\/teapot",status_code="200"\}/g)
  })

  it('records status_code="500" for an SSR render error', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}error`)
    await page.goto(`${ctx.url}metrics`)
    const content = await page.textContent('body')

    expect(content).toMatch(/page_total_time\{path="\/__nuxt_error",status_code="500"\} \d+/g)
    expect(content).toMatch(/page_total_time_histogram_count\{path="\/__nuxt_error",status_code="500"\} [1-9]\d*/g)
    expect(content).not.toMatch(/page_total_time\{path="\/__nuxt_error",status_code="200"\}/g)
  })
})
