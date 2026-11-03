import type { IncomingMessage } from 'node:http'
import http from 'node:http'
import { defineEventHandler } from 'h3'
import { useOutboundUpstreams } from '../../utils/upstreams'

function readBody(response: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = ''
    response.setEncoding('utf8')
    response.on('data', (chunk) => {
      body += chunk
    })
    response.on('end', () => resolve(body))
    response.on('error', reject)
  })
}

export default defineEventHandler(async () => {
  const { httpUrl } = await useOutboundUpstreams()
  const startedAt = Date.now()
  return await new Promise((resolve, reject) => {
    http.get(`${httpUrl}/http`, async (response) => {
      resolve({
        ok: response.statusCode === 200,
        status: response.statusCode,
        elapsedMs: Date.now() - startedAt,
        body: JSON.parse(await readBody(response)),
      })
    }).on('error', reject)
  })
})
