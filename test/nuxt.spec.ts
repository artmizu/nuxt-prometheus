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

    expect(content).toMatch(/page_render_time\{path="\/"\} \d+/g)
    expect(content).toMatch(/page_render_time\{path="\/a"\} \d+/g)
    expect(content).toMatch(/page_render_time\{path="\/b"\} \d+/g)

    expect(content).toMatch(/page_request_time\{path="\/"\} \d+/g)
    expect(content).toMatch(/page_request_time\{path="\/a"\} \d+/g)
    expect(content).toMatch(/page_request_time\{path="\/b"\} \d+/g)

    expect(content).toMatch(/page_total_time\{path="\/"\} \d+/g)
    expect(content).toMatch(/page_total_time\{path="\/a"\} \d+/g)
    expect(content).toMatch(/page_total_time\{path="\/b"\} \d+/g)

    // Summary metrics
    expect(content).toMatch(/page_render_time_summary_count\{path="\/"\} [1-9]\d*/g)
    expect(content).toMatch(/page_render_time_summary_count\{path="\/a"\} [1-9]\d*/g)
    expect(content).toMatch(/page_render_time_summary_count\{path="\/b"\} [1-9]\d*/g)

    expect(content).toMatch(/page_request_time_summary_count\{path="\/"\} [1-9]\d*/g)
    expect(content).toMatch(/page_request_time_summary_count\{path="\/a"\} [1-9]\d*/g)
    expect(content).toMatch(/page_request_time_summary_count\{path="\/b"\} [1-9]\d*/g)

    expect(content).toMatch(/page_total_time_summary_count\{path="\/"\} [1-9]\d*/g)
    expect(content).toMatch(/page_total_time_summary_count\{path="\/a"\} [1-9]\d*/g)
    expect(content).toMatch(/page_total_time_summary_count\{path="\/b"\} [1-9]\d*/g)
  })

  it('check the useFetch measuring time on /b route', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}b`)
    await page.goto(`${ctx.url}metrics`)
    const content = await page.textContent('body')

    expect(content).toMatch(/page_request_time\{path="\/b"\} [1-9]+/g)
  })

  it('check the native fetch measuring time on /c route', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}c`)
    await page.goto(`${ctx.url}metrics`)
    const content = await page.textContent('body')

    expect(content).toMatch(/page_request_time\{path="\/c"\} [1-9]+/g)
  })

  it('check server route without external requests', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}api/plain`)
    await page.goto(`${ctx.url}api/plain/sample`)
    await page.goto(`${ctx.url}metrics`)
    const content = await page.textContent('body')

    expect(content).toMatch(/page_render_time\{path="\/api\/plain"\} \d+/g)
    expect(content).toMatch(/page_render_time\{path="\/api\/plain\/:id"\} \d+/g)
  })

  it('check server route with external requests', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}api/complex`)
    await page.goto(`${ctx.url}api/complex/sample`)
    await page.goto(`${ctx.url}metrics`)
    const content = await page.textContent('body')

    expect(content).toMatch(/page_render_time\{path="\/api\/complex"\} \d+/g)
    expect(content).toMatch(/page_render_time\{path="\/api\/complex\/:id"\} \d+/g)

    expect(content).toMatch(/page_request_time\{path="\/api\/complex"\} \d+/g)
    expect(content).toMatch(/page_request_time\{path="\/api\/complex\/:id"\} \d+/g)

    expect(content).toMatch(/page_total_time\{path="\/api\/complex"\} \d+/g)
    expect(content).toMatch(/page_total_time\{path="\/api\/complex\/:id"\} \d+/g)
  })
})
