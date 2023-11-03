<script setup>
import { defineProps, computed, shallowRef, watch } from 'vue';
import { GameEvent } from '/@/composables/game-event-queue.js';
import PlayerListItem from '/@/components/PlayerListItem.vue';
import CardsDisplay from '/@/components/CardsDisplay.vue';
import { Tooltip } from 'bootstrap';
import ProposeHandModal from '/@/components/ProposeHandModal.vue';
import PlayerReadyDisplay from '/@/components/PlayerReadyDisplay.vue';
import { useGameState } from '/@/composables/game-state.js';
import ReadyButton from './ReadyButton.vue';

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
  }
});

defineEmits(['proposed', 'called', 'returnLobby', 'set-ready']);

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
      customClass: 'fs-3 text-danger',
      container: el
    }).show();
  } else {
    console.debug(`Removing tooltip!`);
    Tooltip.getInstance(el.querySelector('.player-display-name-text'))?.hide();
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
  canCall,
  gameHasEnded,
  gameWinner
} = useGameState(computed(() => props.thisPlayerId), computed(() => props.currentGameEvent));
const showProposeHandModal = shallowRef(false);

watch(currentPlayerTurn, () => {
  showProposeHandModal.value = false;
});

</script>

<template>
  <ul class="list-group">
    <li class="list-group-item container-fluid" v-for="playerID of (playersOrder ?? Object.keys(playersInfo))" :key="playerID"
      :class='{
        "active": playerID === currentPlayerTurn,
        "border": playerID === winner || playerID === loser,
        "border-5": playerID === winner || playerID === loser,
        "border-success": playerID === winner,
        "border-danger": playerID === loser
      }'
    >
      <PlayerReadyDisplay v-if="gameHasEnded && playersInfo[playerID]" :ready="playersInfo[playerID].ready"/>
      <PlayerListItem v-if="playersInfo[playerID]"
        v-player-call-tooltip="playerID === caller"
        :username="playersInfo[playerID].username"
        :connection="playersInfo[playerID].connection"
      >
        <template #contextItem>
          <span class="flex-shrink-0" v-if="thisPlayerId === playerID">
            <CardsDisplay :cards='playerHand'/>
          </span>
          <span class="flex-shrink-0" v-else-if="playersToCardsMap && playersToCardsMap[playerID]">
            <CardsDisplay v-if='typeof playersToCardsMap[playerID] === "number"' :num-cards='playersToCardsMap[playerID]'/>
            <CardsDisplay v-else-if='Array.isArray(playersToCardsMap[playerID])' :cards='playersToCardsMap[playerID]'/>
          </span>
        </template>
      </PlayerListItem>
    </li>
  </ul>
  <div v-if="lastHand && lastPlayerTurn && playersInfo[lastPlayerTurn]" class="mt-3">
    <span><h2 class="fw-bold"> {{ playersInfo[lastPlayerTurn].username }} proposed hand: </h2><CardsDisplay :cards='lastHand'/></span>
  </div>
  <div class="text-center container-fluid mt-3">
    <div v-if="!gameHasEnded" class="row-cols">
      <template v-if="currentPlayerTurn === thisPlayerId">
        <button class="btn col btn-primary me-3" @click="showProposeHandModal = true">Create Proposed Hand</button>
        <Teleport to='body'>
          <ProposeHandModal v-if="showProposeHandModal"
            :last-hand="lastHand ?? []"
            @close="() => showProposeHandModal = false"
            @proposed="(hand) => $emit('proposed', hand)"
          />
        </Teleport>
      </template>
      <button class="btn col btn-danger" :disabled="!canCall" @click="() => $emit('called', lastPlayerTurn)">Call!</button>
    </div>
    <div v-else class="text-center container-fluid mt-3">
      <h2 class="row-cols">Game Over!</h2>
      <h2 v-if="gameWinner && playersInfo[gameWinner]" class="row-cols fw-bold">
        <span class="col me-2">Winner 👑:</span>
        <span class="col">{{ playersInfo[gameWinner].username }}!</span>
      </h2>
      <div class="row mt-3">
        <button class="col ms-md-5 btn btn-secondary me-3" @click="() => $emit('returnLobby')">Return to Lobby</button>
        <ReadyButton class="col me-md-5" :remote-ready="playersInfo[thisPlayerId].ready" @set-ready="(ready) => $emit('set-ready', ready)"/>
      </div>
    </div>
  </div>
</template>
