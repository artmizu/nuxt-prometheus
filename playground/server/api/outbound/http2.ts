import http2 from 'node:http2'
import { defineEventHandler } from 'h3'
import { useOutboundUpstreams } from '../../utils/upstreams'

export default defineEventHandler(async () => {
  const { http2Url } = await useOutboundUpstreams()
  const startedAt = Date.now()
  const session = http2.connect(http2Url)
  session.setTimeout(3000)
  try {
    const body = await new Promise<string>((resolve, reject) => {
      const request = session.request({ ':path': '/http2', ':method': 'GET' })
      let received = ''
      request.on('data', (chunk) => {
        received += chunk
      })
      request.on('end', () => resolve(received))
      request.on('error', reject)
      session.on('timeout', () => reject(new Error('http2 session timed out')))
      request.end()
    })
    return { ok: true, elapsedMs: Date.now() - startedAt, body }
  }
  finally {
    session.close()
  }
})
