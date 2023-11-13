<script setup>
import { ref, defineAsyncComponent, shallowRef, computed, nextTick } from 'vue';
import { useWebSocket, WS_CONNECTION_STATE } from '/@/composables/websocket.js';
import { useLobby } from '/@/composables/lobby.js';
import { useGameEventQueue } from '/@/composables/game-event-queue.js';
import PreGameLobbyDisplay from '/@/components/PreGameLobbyDisplay.vue';
import detectColorMode from "/@/utilities/detect-color-mode.js";

const GameDisplay = defineAsyncComponent(async () =>
  import('/@/components/GameDisplay.vue')
);

const lobbyEvent = shallowRef(null);
const gameEvent = shallowRef(null);
const thisPlayerID = shallowRef(null);
const initialized = shallowRef(false);

detectColorMode();

function onWSJSONMsg(msg) {
  if (!msg.type || typeof msg.type !== 'string') return;
  console.debug(`Received message: ${JSON.stringify(msg)}`);
  switch (msg.type) {
    case 'CLIENT_EVENT': {
      if (msg.event === 'CONNECTION_ACK') {
        if (!msg.snapshot) return;
        lobbyEvent.value = {
          event: 'INITIALIZE',
          snapshot: msg.snapshot.lobby
        }
        gameEvent.value = {
          event: 'INITIALIZE',
          snapshot: msg.snapshot.game
        }
        thisPlayerID.value = msg.snapshot.playerID;
        nextTick(() => {
          initialized.value = true;
        });
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

const { wsConnectionState, sendMsg } = useWebSocket(onWSJSONMsg);
const { playersInfo, inGame } = useLobby(lobbyEvent);
const { currentGameEvent } = useGameEventQueue(gameEvent);

const connectionState = computed(() => initialized.value ? wsConnectionState.value : WS_CONNECTION_STATE.CONNECTING);

const CLIENT_MSGS = {
  PROPOSED_HAND: "PROPOSED_HAND",
  CALL_PLAYER: "CALL_PLAYER",
  READY_UP: "READY_UP",
  READY_DOWN: "READY_DOWN",
  RETURN_TO_PRE_GAME_LOBBY: "RETURN_TO_PRE_GAME_LOBBY",
}

function sendReturnToPreGameLobby() {
  sendMsg({
    type: CLIENT_MSGS.RETURN_TO_PRE_GAME_LOBBY
  });
}

function sendProposeHand(hand) {
  sendMsg({
    type: CLIENT_MSGS.PROPOSED_HAND,
    proposedHand: hand
  });
}

function sendCall(player) {
  sendMsg({
    type: CLIENT_MSGS.CALL_PLAYER,
    playerID: player
  });
}

function sendReady(ready) {
  sendMsg({
    type: ready ? CLIENT_MSGS.READY_UP : CLIENT_MSGS.READY_DOWN
  });
}

</script>

<template>
  <main>
    <div class="d-flex justify-content-center align-items-center">
      <div class="container min-vh-100">
        <div class="row m-3 justify-content-center align-items-start">
          <h1 class="fw-bold">Liar's Poker</h1>
        </div>
        <div class="row m-3" v-if="connectionState === WS_CONNECTION_STATE.CONNECTING">
          <h2>
            <span class="spinner-border ml-auto"></span>
            Connecting...
          </h2>
        </div>
        <div class="row m-3 text-danger" v-else-if="connectionState === WS_CONNECTION_STATE.DISCONNECTED">
          <h2>
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            <span>Connection Lost!</span>
          </h2>
          <a class="btn btn-primary" href="/">Go Home</a>
        </div>
        <PreGameLobbyDisplay class="row m-3" v-else-if="!inGame"
          :players-info="playersInfo"
          :this-player-id="thisPlayerID"
          @set-ready="sendReady"
        />
        <GameDisplay class="row m-3" v-else
          :current-game-event="currentGameEvent"
          :players-info="playersInfo"
          :this-player-id="thisPlayerID"
          @proposed="sendProposeHand"
          @called="sendCall"
          @returnLobby="sendReturnToPreGameLobby"
          @set-ready="sendReady"
        />
      </div>
    </div>
  </main>
</template>
