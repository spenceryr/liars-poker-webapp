<script setup>
import 'vite/modulepreload-polyfill'
import { onMounted, ref, defineAsyncComponent, shallowRef, computed } from 'vue';
import PlayerListItem from '/@/components/PlayerListItem.vue'
import { useWebSocket } from '/@/composables/useWebSocket.js'
import { useLobby } from '/@/composables/useLobby.js'
import { useGame } from '/@/composables/useGame.js'

const GameView = defineAsyncComponent(() => {
  import('/@/components/GameView.vue');
});

const lobbyEvent = shallowRef();
const gameEvent = shallowRef();
const player = ref({});
const initialized = shallowRef(false);

function onWSJSONMsg(msg) {
  if (!msg.type || typeof msg.type !== 'string') return;
  switch (msg.type) {
    case 'CLIENT_EVENT': {
      if (msg.event === 'CONNECTION_ACK') {
        if (!msg.snapshot) return;
        lobbyEvent = {
          type: 'INITIALIZE',
          snapshot: msg.snapshot.lobby
        }
        gameEvent = {
          type: 'INITIALIZE',
          snapshot: msg.snapshot.game
        }
        player.value = {
          id: msg.snapshot.playerID
        }
        initialized.value = true;
      }
      break;
    }
    case "LOBBY_EVENT": {
      lobbyEvent = msg;
      break;
    }
    case "GAME_EVENT": {
      gameEvent = msg;
      break;
    }
  }
}

var { connected: wsConnected } = useWebSocket(onWSJSONMsg);
var { players, lastWinner, inPreGameLobby } = useLobby(lobbyEvent);
var { gameState } = useGame(gameEvent);

var connected = computed(() => wsConnected.value && initialized.value);

</script>

<template>
  <header>
    <title>Liar's Poker</title>
  </header>

  <main>
    <div class="d-flex justify-content-center align-items-center">
      <div class="container min-vh-100">
        <div class="row m-3 justify-content-center align-items-start">
          <h1 class="fw-bold">Liar's Poker For Da Boys</h1>
        </div>
        <div v-if="!connected">
          <h2>Connecting...</h2>
          <span class="spinner-border ml-auto"></span>
        </div>
        <!-- TODO: (spencer) Use a "dynamic component" here to choose the view based on lobby/game state -->
        <ul v-else class="list-group">
          <PlayerListItem v-for="player of lobbyState.players"
            :player-id="player.id"
            :connection="player.connection"
            :ready="player.ready"
            :active="player.id === localPlayer"
          />
        </ul>
      </div>
    </div>
  </main>
</template>
