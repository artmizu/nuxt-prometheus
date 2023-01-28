import { defineEventHandler } from 'h3'
import { register } from 'prom-client'

export default defineEventHandler(async (event) => {
  try {
    const data = await register.metrics()
    event.res.setHeader('Content-Type', register.contentType)
    event.res.end(data)
  }
  catch (e) {
    event.res.statusCode = 500
    event.res.end(e)
  }
})
