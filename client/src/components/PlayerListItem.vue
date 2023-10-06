<script setup>
import { defineProps, computed } from 'vue'
import PlayerConnectionDisplay from '/@/components/PlayerConnectionDisplay.vue'
import PlayerReadyDisplay from '/@/components/PlayerReadyDisplay.vue'

defineProps({
  playerID: String,
  connection: String,
  ready: Boolean,
  active: Boolean
})

</script>

<template>
  <li class="list-group-item container d-flex">
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
        <PlayerReadyDisplay :ready='ready'/>
      </div>
    </div>
  </li>
</template>
