import { defineEventHandler } from 'h3'

export default defineEventHandler(async (event) => {
  const response = await fetch('https://jsonplaceholder.typicode.com/todos')
  const data = await response.json()

  return {
    data,
  }
})
