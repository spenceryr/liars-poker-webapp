<script setup>
import { defineProps, defineEmits, computed } from 'vue';
import ReadyButton from '/@/components/ReadyButton.vue'
import PlayerListItem from './PlayerListItem.vue';
import PlayerReadyDisplay from './PlayerReadyDisplay.vue';

defineEmits(['set-ready']);

const props = defineProps({
  playersInfo: {
    type: Object,
    required: true
  },
  thisPlayerId: {
    type: String,
    required: true
  }
})

const thisPlayerInfo = computed(() => {
  return props.playersInfo[props.thisPlayerId];
})
</script>

<template>
  <!-- TODO: (spencer) Add header to columns or just a title -->
  <ul class="list-group">
    <li class="list-group-item container-fluid" v-for="(playerInfo, playerID) in playersInfo">
      <PlayerListItem
        :username="playerInfo.username"
        :connection="playerInfo.connection"
        :active="playerID === thisPlayerId"
      >
        <template #contextItem>
          <PlayerReadyDisplay :ready='playerInfo.ready'/>
        </template>
      </PlayerListItem>
    </li>
  </ul>
  <ReadyButton class="mt-3" :remote-ready="thisPlayerInfo.ready" @set-ready="(ready) => $emit('set-ready', ready)"/>
</template>
