<script setup>
import { defineProps } from 'vue'
import PlayerConnectionDisplay from '/@/components/PlayerConnectionDisplay.vue'

defineProps({
  playerID: String,
  connection: String,
  ready: Boolean,
  active: Boolean
})

</script>

<template>
  <div class="row justify-content-between align-items-center">
    <div class="col">
      <div class="row">
        <div class="col">
          {{ playerID }}
        </div>
        <div class="col ms-2">
          <PlayerConnectionDisplay :conn='connection'/>
        </div>
      </div>
    </div>
    <div class="col">
      <slot name="contextItem"></slot>
    </div>
  </div>
</template>
