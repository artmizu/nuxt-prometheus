import type { H3Event } from 'h3'
import { setResponseStatus } from 'h3'

export default function teapotHandler(event: H3Event) {
  setResponseStatus(event, 418)
  return {
    message: 'I am a teapot',
  }
}
