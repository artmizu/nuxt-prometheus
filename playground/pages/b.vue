<script setup lang="ts">
import { useFetch } from '#app'

const response = await useFetch('https://jsonplaceholder.typicode.com/todos')
</script>

<template>
  <div>
    bbb
    <div id="response">
      {{ response.data }}
    </div>
  </div>
</template>
