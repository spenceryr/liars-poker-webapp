<script setup>
import { defineProps } from 'vue'
import PlayerConnectionDisplay from '/@/components/PlayerConnectionDisplay.vue'

defineProps({
  playerId: String,
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
          <div>
            {{ playerId }}
            <PlayerConnectionDisplay class="mx-2" :conn='connection'/>
          </div>
        </div>
      </div>
    </div>
    <div class="col text-end">
      <slot name="contextItem"></slot>
    </div>
  </div>
</template>
