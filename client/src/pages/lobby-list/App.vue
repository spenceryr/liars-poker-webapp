<script setup>
import HelloWorld from '/@/components/HelloWorld.vue'
import TheWelcome from '/@/components/TheWelcome.vue'
import logo from '/@/assets/logo.svg'


// import 'vite/modulepreload-polyfill'
</script>

<template>
  <header>
    <img alt="Vue logo" class="logo" :src='logo' width="125" height="125" />

    <div class="wrapper">
      <HelloWorld msg="You did it!" />
      <p>LOBBY LIST</p>
    </div>
  </header>

  <main>
    <TheWelcome />
  </main>
</template>

