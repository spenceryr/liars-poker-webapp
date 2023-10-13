<script setup>
import { defineProps, shallowRef, watch } from 'vue';
import { GameEvent, GAME_EVENTS } from '/@/composables/game-event-queue';
import PlayerListItem from '/@/components/PlayerListItem.vue';
import CardsDisplay from '/@/components/CardsDisplay.vue';
import { Tooltip } from 'bootstrap';
import ProposeHandModal from '/@/components/ProposeHandModal.vue';
import PlayerReadyDisplay from '/@/components/PlayerReadyDisplay.vue';

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

const playersCardMap = shallowRef(null);
const playerHand = shallowRef(null);
const playersOrder = shallowRef(null);
const currentPlayerTurn = shallowRef(null);
const lastPlayerTurn = shallowRef(null);
const lastHand = shallowRef(null);
const winner = shallowRef(null);
const loser = shallowRef(null);
const caller = shallowRef(null);
const showProposeHandModal = shallowRef(false);
const canCall = shallowRef(false);
const gameHasEnded = shallowRef(false);

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

watch(() => props.gameOver, (gameOver) => {
  if (!gameOver) return;
  gameHasEnded.value = true;
  canCall.value = false;
  currentPlayerTurn.value = null;
  showProposeHandModal.value = false;
});

watch(() => props.currentGameEvent, async (event) => {
  if (!event) return;
  if (gameHasEnded) return;
  switch (event.type) {
    case GAME_EVENTS.INITIALIZE: {
      const data = event.data;
      currentPlayerTurn.value = data.currentPlayerTurn;
      lastHand.value = data.lastHand;
      lastPlayerTurn.value = data.lastHandPlayer;
      playersOrder.value = data.playersOrder;
      playersCardMap.value = data.playersNumCards;
      playerHand.value = data.playerHand;
      break;
    }
    case GAME_EVENTS.SETUP: {
      const data = event.data;
      playersOrder.value = data.playersOrder;
      playerHand.value = data.playerHand;
      playersCardMap.value = data.playersNumCards;
      lastHand.value = null;
      currentPlayerTurn.value = null;
      lastPlayerTurn.value = null;
      winner.value = null;
      loser.value = null;
      caller.value = null;
      canCall.value = false;
      await new Promise((resolve) => setTimeout(resolve, 1 * 1000));
      break;
    }
    case GAME_EVENTS.PLAYER_TURN: {
      const data = event.data;
      currentPlayerTurn.value = data.player;
      if (data.player === props.thisPlayerId) showProposeHandModal.value = true;
      else canCall.value = true;
      break;
    }
    case GAME_EVENTS.PLAYER_PROPOSE_HAND: {
      const data = event.data;
      lastPlayerTurn.value = data.player;
      lastHand.value = data.proposedHand;
      currentPlayerTurn.value = null;
      canCall.value = false;
      break;
    }
    case GAME_EVENTS.REVEAL: {
      const data = event.data;
      playersCardMap.value = data.allPlayersCards;
      currentPlayerTurn.value = null;
      canCall.value = false;
      caller.value = [data.winner, data.loser].filter((player) => lastPlayerTurn.value !== player)[0];
      await new Promise((resolve) => setTimeout(resolve, 1 * 1000));
      winner.value = data.winner;
      loser.value = data.loser;
      await new Promise((resolve) => setTimeout(resolve, 5 * 1000));
      break;
    }
  }
  event.consume();
})
</script>

<template>
  <ul class="list-group">
    <li class="list-group-item container d-flex" v-for="playerID of (playersOrder ?? Object.keys(playersInfo))">
      <PlayerReadyDisplay v-if="gameHasEnded" :ready="playersInfo[playerID].ready"></PlayerReadyDisplay>
      <PlayerListItem
        v-player-call-tooltip="playerID === caller"
        :player-id="playerID"
        :connection="playersInfo[playerID].connection"
        :active="playerID === currentPlayerTurn"
        :class='{
          "border": playerID === winner || playerID === loser,
          "border-5": playerID === winner || playerID === loser,
          "border-success": playerID === winner,
          "border-failure": playerID === loser
        }'
      >
        <template #contextItem>
          <span>
            <CardsDisplay v-if='typeof playersCardMap[0] === "number"' :num-cards='playersCardMap[playerID]'/>
            <CardsDisplay v-else-if='Array.isArray(playersCardMap[0])' :cards='playersCardMap[playerID]'/>
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
        @close="() => showProposeHandModal = false"
        @proposed="(hand) => $emit('proposed', hand)"
      />
    </Teleport>
  </div>
  <div v-else-if="!gameHasEnded">
    <button class="btn btn-danger" :disabled="canCall" @click="() => $emit('called', currentPlayerTurn)">Call!</button>
  </div>
</template>
