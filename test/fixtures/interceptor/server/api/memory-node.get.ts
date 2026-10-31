import http from 'node:http'
import { defineEventHandler } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'

export default defineEventHandler(() => new Promise<string>((resolve, reject) => {
  http.get(String(useRuntimeConfig().upstream), (response) => {
    let body = ''
    response.setEncoding('utf8')
    response.on('data', (chunk) => {
      body += chunk
    })
    response.on('end', () => resolve(body))
    response.on('error', reject)
  }).on('error', reject)
}))
