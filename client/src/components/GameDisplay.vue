<script setup>
import { VueElement, createElementBlock, defineProps, shallowRef, watch } from 'vue';
import { GameEvent, GAME_EVENTS } from '/@/composables/game-event-queue';
import PlayerListItem from './PlayerListItem.vue';
import CardsDisplay from './CardsDisplay.vue';
import { Tooltip } from 'bootstrap';

const props = defineProps({
  currentGameEvent: GameEvent,
  playersInfo: Object,
});
const playersCardMap = shallowRef(null);
const playerHand = shallowRef(null);
const playersOrder = shallowRef(null);
const currentPlayerTurn = shallowRef(null);
const lastPlayerTurn = shallowRef(null);
const lastHand = shallowRef(null);
const winner = shallowRef(null);
const loser = shallowRef(null);
const caller = shallowRef(null);

const toolTipBind = (el, binding) => {
  if (binding.value) {
    Tooltip.getOrCreateInstance(el, {
      placement: 'left',
      title: 'Call!',
      trigger: 'manual'
    }).tooltip('show');
  } else {
    Tooltip.getInstance(el)?.dispose();
  }
};
const vPlayerCallTooltip = {
  mounted: toolTipBind,
  update: toolTipBind,
}

watch(() => props.currentGameEvent, async (event) => {
  if (!event) return;
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
      await new Promise((resolve) => setTimeout(resolve, 1 * 1000));
      break;
    }
    case GAME_EVENTS.PLAYER_TURN: {
      const data = event.data;
      currentPlayerTurn.value = data.player;
      break;
    }
    case GAME_EVENTS.PLAYER_PROPOSE_HAND: {
      const data = event.data;
      lastPlayerTurn.value = data.player;
      lastHand.value = data.proposedHand;
      currentPlayerTurn.value = null;
      break;
    }
    case GAME_EVENTS.REVEAL: {
      const data = event.data;
      playersCardMap.value = data.allPlayersCards;
      currentPlayerTurn.value = null;
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
    <PlayerListItem v-for="playerID of playersOrder"
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
        <CardsDisplay v-if='typeof playersCardMap[0] === "number"' :num-cards='playersCardMap[playerID]'/>
        <CardsDisplay v-else-if='Array.isArray(playersCardMap[0])' :cards='playersCardMap[playerID]'/>
      </template>
    </PlayerListItem>
    <div v-if="lastHand && lastPlayerTurn">
      <h2> {{ lastPlayerTurn }} proposed hand: <CardsDisplay :cards='lastHand'/></h2>
      <h3 class='text-body-secondary fst-italic'>Note: Suits are random.</h3>
    </div>
  </ul>
</template>
