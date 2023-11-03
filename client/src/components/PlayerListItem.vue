<script setup>
import { defineProps } from 'vue'
import PlayerConnectionDisplay from '/@/components/PlayerConnectionDisplay.vue'

defineProps({
  username: String,
  connection: String,
  active: Boolean
})

</script>

<template>
  <div class="d-flex flex-row justify-content-between align-items-center">
    <div class="">
      <p class="player-display-name-text d-inline fw-bold">{{ username }}</p>
      <PlayerConnectionDisplay class="mx-2" :conn='connection'/>
    </div>
    <slot name="contextItem"></slot>
  </div>
</template>
