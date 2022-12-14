import { defineEventHandler } from 'h3'
import { register } from 'prom-client'

export default defineEventHandler(async ({ res }) => {
  try {
    res.setHeader('Content-Type', register.contentType)
    res.end(await register.metrics())
  }
  catch (e) {
    res.statusCode = 500
    res.end(e)
  }
})
