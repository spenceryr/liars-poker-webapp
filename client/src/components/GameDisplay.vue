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

/**
 *
 * @param {Element} el
 * @param {import('vue').DirectiveBinding} binding
 */
const vPlayerCallTooltip = (el, binding) => {
  if (binding.value) {
    console.debug(`Creating tooltip!`);
    Tooltip.getOrCreateInstance(el.querySelector('.player-display-name-text'), {
      placement: 'right',
      title: 'Call!',
      trigger: 'manual',
      template: '<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner fs-3 text-danger"></div></div>'
    }).show();
  } else {
    console.debug(`Removing tooltip!`);
    Tooltip.getInstance(el)?.hide();
  }
};

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
    <li class="list-group-item container-fluid" v-for="playerID of (playersOrder ?? Object.keys(playersInfo))" :key="playerID"
      :class='{
        "active": playerID === currentPlayerTurn,
        "border": playerID === winner || playerID === loser,
        "border-5": playerID === winner || playerID === loser,
        "border-success": playerID === winner,
        "border-failure": playerID === loser
      }'
    >
      <PlayerReadyDisplay v-if="gameHasEnded" :ready="playersInfo[playerID].ready"/>
      <PlayerListItem
        v-player-call-tooltip="playerID === caller"
        :player-id="playerID"
        :connection="playersInfo[playerID].connection"
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
  <div v-if="lastHand && lastPlayerTurn" class="mt-3">
    <span><h2> {{ lastPlayerTurn }} proposed hand: </h2><CardsDisplay :cards='lastHand'/></span>
  </div>
  <div class="d-inline-flex flex-row mt-3">
    <div v-if="currentPlayerTurn === thisPlayerId">
      <button class="btn btn-primary me-3" @click="showProposeHandModal = true">Create Proposed Hand</button>
      <Teleport to='body'>
        <ProposeHandModal v-if="showProposeHandModal"
          :last-hand="lastHand ?? []"
          @close="() => showProposeHandModal = false"
          @proposed="(hand) => $emit('proposed', hand)"
        />
      </Teleport>
    </div>
    <div v-if="!gameHasEnded">
      <button class="btn btn-danger" :disabled="!canCall" @click="() => $emit('called', lastPlayerTurn)">Call!</button>
    </div>
  </div>
</template>
