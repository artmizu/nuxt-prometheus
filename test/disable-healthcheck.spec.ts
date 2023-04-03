import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createPage, setup } from '@nuxt/test-utils'

describe('custom module params test', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../playground', import.meta.url)),
    nuxtConfig: {
      // @ts-expect-error TODO figure out
      prometheus: {
        healthCheck: false,
      },
    },
  })

  it('health page check', async () => {
    const page = await createPage('/health')
    expect(await page.innerText('body')).toContain('404')
  })
})
