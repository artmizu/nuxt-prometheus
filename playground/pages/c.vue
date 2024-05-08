<script setup lang="ts">
const response = await fetch('https://jsonplaceholder.typicode.com/todos')
const data = await response.json()
</script>

<template>
  <div>
    bbb
    <div id="response">
      {{ data }}
    </div>
  </div>
</template>
