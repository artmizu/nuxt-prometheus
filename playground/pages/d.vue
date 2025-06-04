<script setup lang="ts">
import { ofetch } from 'ofetch'

const test = ofetch.create({
  baseURL: 'https://jsonplaceholder.typicode.com',
})

const response = await test('/todos')
</script>

<template>
  <div>
    <div id="response">
      {{ response.data }}
    </div>
  </div>
</template>
