import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createPage, setup } from '@nuxt/test-utils'

describe('custom module params test', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../playground', import.meta.url)),
    nuxtConfig: {
      // @ts-expect-error TODO figure out
      prometheus: {
        healthCheckPath: '/h',
        prometheusPath: '/p',
      },
    },
  })

  it('health page check', async () => {
    const page = await createPage('/h')
    expect(await page.innerText('body')).toContain('ok')
  })

  it('node metrics check', async () => {
    await createPage('/')
    const page = await createPage('/p')
    const content = await page.innerText('body')
    expect(content).toMatch(/^playground_process_start_time_seconds\ \d+/gm)
  })
})
