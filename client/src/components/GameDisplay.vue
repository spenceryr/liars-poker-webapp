<script setup>
import { defineProps, computed } from 'vue';
import { GameEvent } from '/@/composables/game-event-queue.js';
import PlayerListItem from '/@/components/PlayerListItem.vue';
import CardsDisplay from '/@/components/CardsDisplay.vue';
import { Tooltip } from 'bootstrap';
import ProposeHandModal from '/@/components/ProposeHandModal.vue';
import PlayerReadyDisplay from '/@/components/PlayerReadyDisplay.vue';
import { useGameState } from '/@/composables/game-state.js';

const props = defineProps({
  currentGameEvent: {
    type: GameEvent,
    required: true
  },
  playersInfo: {
    type: Object,
    required: true
  },
  thisPlayerId: {
    type: String,
    required: true
  },
  gameOver: {
    type: Boolean,
    required: true
  }
});

defineEmits(['proposed', 'called']);

const toolTipBind = (el, binding) => {
  if (binding.value) {
    Tooltip.getOrCreateInstance(el, {
      placement: 'left',
      title: 'Call!',
      trigger: 'manual'
    }).show();
  } else {
    Tooltip.getInstance(el)?.dispose();
  }
};
const vPlayerCallTooltip = {
  mounted: toolTipBind,
  update: toolTipBind,
}

const {
  playersToCardsMap,
  playerHand,
  playersOrder,
  currentPlayerTurn,
  lastPlayerTurn,
  lastHand,
  winner,
  loser,
  caller,
  showProposeHandModal,
  canCall,
  gameHasEnded
} = useGameState(computed(() => props.thisPlayerId), computed(() => props.currentGameEvent), computed(() => props.gameOver));

</script>

<template>
  <ul class="list-group">
    <li class="list-group-item container-fluid" v-for="playerID of (playersOrder ?? Object.keys(playersInfo))">
      <PlayerReadyDisplay v-if="gameHasEnded" :ready="playersInfo[playerID].ready"/>
      <PlayerListItem
        v-player-call-tooltip="playerID === caller"
        :player-id="playerID"
        :connection="playersInfo[playerID].connection"
        :class='{
          "active": playerID === currentPlayerTurn,
          "border": playerID === winner || playerID === loser,
          "border-5": playerID === winner || playerID === loser,
          "border-success": playerID === winner,
          "border-failure": playerID === loser
        }'
      >
        <template #contextItem>
          <span v-if="thisPlayerId === playerID">
            <CardsDisplay :cards='playerHand'/>
          </span>
          <span v-else-if="playersToCardsMap && playersToCardsMap[playerID]">
            <CardsDisplay v-if='typeof playersToCardsMap[playerID] === "number"' :num-cards='playersToCardsMap[playerID]'/>
            <CardsDisplay v-else-if='Array.isArray(playersToCardsMap[playerID])' :cards='playersToCardsMap[playerID]'/>
          </span>
        </template>
      </PlayerListItem>
    </li>
  </ul>
  <div v-if="lastHand && lastPlayerTurn">
    <span><h2> {{ lastPlayerTurn }} proposed hand: </h2><CardsDisplay :cards='lastHand'/></span>
    <h3 class='text-body-secondary fst-italic'>Note: Suits are random.</h3>
  </div>
  <div v-if="currentPlayerTurn === thisPlayerId">
    <button class="btn btn-primary" @click="showProposeHandModal = true">Create Proposed Hand</button>
    <Teleport to='body'>
      <ProposeHandModal v-if="showProposeHandModal"
        :last-hand="lastHand ?? []"
        @close="() => showProposeHandModal = false"
        @proposed="(hand) => $emit('proposed', hand)"
      />
    </Teleport>
  </div>
  <div v-else-if="!gameHasEnded">
    <button class="btn btn-danger" :disabled="!canCall" @click="() => $emit('called', currentPlayerTurn)">Call!</button>
  </div>
</template>
