<script setup>
import 'vite/modulepreload-polyfill'
import { ref, defineAsyncComponent, shallowRef, computed } from 'vue';
import PlayerListItem from '/@/components/PlayerListItem.vue'
import PlayerReadyDisplay from '/@/components/PlayerReadyDisplay.vue';
import { useWebSocket } from '/@/composables/websocket.js'
import { useLobby } from '/@/composables/lobby.js'
import { useGameEventQueue } from '/@/composables/game-event-queue'

// const GameView = defineAsyncComponent(() => {
//   import('/@/components/GameView.vue');
// });

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
        lobbyEvent.value = {
          type: 'INITIALIZE',
          snapshot: msg.snapshot.lobby
        }
        gameEvent.value = {
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
      lobbyEvent.value = msg;
      break;
    }
    case "GAME_EVENT": {
      gameEvent.value = msg;
      break;
    }
  }
}

const { connected: wsConnected } = useWebSocket(onWSJSONMsg);
const { players, lastWinner, inPreGameLobby } = useLobby(lobbyEvent);
const { currentGameEvent } = useGameEventQueue(gameEvent);

const connected = computed(() => wsConnected.value && initialized.value);

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
          <PlayerListItem v-for="(playerInfo, playerID) in players"
            :player-id="playerID"
            :connection="playerInfo.connection"
            :active="playerID === player"
          >
            <template #contextItem>
              <PlayerReadyDisplay :ready='playerInfo.ready'/>
            </template>
          </PlayerListItem>
          />
        </ul>
      </div>
    </div>
  </main>
</template>
