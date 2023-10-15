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
  <ul class="list-group">
    <li class="list-group-item container-fluid" v-for="(playerInfo, playerID) in playersInfo">
      <PlayerListItem
        :player-id="playerID"
        :connection="playerInfo.connection"
        :active="playerID === thisPlayerId"
      >
        <template #contextItem>
          <PlayerReadyDisplay class="text-end" :ready='playerInfo.ready'/>
        </template>
      </PlayerListItem>
    </li>
  </ul>
  <ReadyButton :remote-ready="thisPlayerInfo.ready" @set-ready="(ready) => $emit('set-ready', ready)"/>
</template>
