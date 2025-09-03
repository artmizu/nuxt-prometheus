<script setup lang="ts">
import { ofetch } from 'ofetch'

const test = ofetch.create({
  baseURL: 'https://jsonplaceholder.typicode.com',
})

const response = await test('/todos')

if (import.meta.server) {
  const mb = process.memoryUsage().heapUsed / 1024 / 1024
  // eslint-disable-next-line no-console
  console.log(`Memory usage: ${mb.toFixed(2)} MB`)
}
</script>

<template>
  <div>
    <div id="response">
      {{ response.data }}
    </div>
  </div>
</template>
