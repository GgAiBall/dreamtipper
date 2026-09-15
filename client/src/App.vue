<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup>
</script>

<style>
*, *::before, *::after { box-sizing: border-box; }
body {
  font-family: 'Noto Sans SC', sans-serif;
  background: #0D1117;
  color: #E6EDF3;
  line-height: 1.6;
}
a { color: #58A6FF; text-decoration: underline; text-underline-offset: 2px; }
a:hover { color: #79B8FF; text-decoration: underline; }
input, select, textarea, button {
  font-family: 'Noto Sans SC', sans-serif;
}
.mono { font-family: 'JetBrains Mono', monospace; }
</style>
