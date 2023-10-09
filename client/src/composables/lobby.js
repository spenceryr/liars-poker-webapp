import { watch, ref, shallowRef, toValue } from "vue";
import { checkType, checkTypes } from "/@/utilities/checkType";

export function useLobby(lobbyEvent) {
  /** @type {import("vue").Ref<Object<string, {connection: String, ready: boolean }>>} */
  const players = ref({});
  /** @type {import("vue").Ref<string>} */
  const lastWinner = shallowRef(null);
  /** @type {import("vue").Ref<string>} */
  const lobbyScreen = shallowRef(null);

  function setPlayer(playerID, connection, ready) {
    const playerInfo = { connection: connection, ready: ready };
    players.value[playerID] = playerInfo;
  }

  watch(lobbyEvent, (newLobbyEvent) => {
    const lobbyEvent = toValue(newLobbyEvent);
    if (!checkTypes([lobbyEvent, lobbyEvent.event], ['object', 'string'])) return;
    switch (lobbyEvent.event) {
      case 'INITIALIZE': {
        const snapshot = lobbyEvent.snapshot;
        if (!checkType(snapshot, 'object')) return;
        const snapPlayers = snapshot.playerSnapshots;
        const snapLastWinner = snapshot.lastWinner;
        const snapLobbyState = snapshot.lobbyState;
        if (!checkTypes([snapPlayers, snapLastWinner, snapLobbyState], ['object', 'string', 'string'])) return;
        // TODO: (spencer) Maybe validate the object more.
        players.value = snapPlayers;
        lastWinner.value = snapLastWinner;
        lobbyScreen.value = snapLobbyState;
        break;
      }
      case 'PLAYER_CONNECT': {
        const playerID = lobbyEvent.player;
        if (!checkType(playerID, 'string')) return;
        setPlayer(playerID, 'CONNECTED', false);
        break;
      }
      case 'PLAYER_JOINED': {
        const playerID = lobbyEvent.player;
        if (!checkType(playerID, 'string')) return;
        setPlayer(playerID, 'DISCONNECTED', false);
        break;
      }
      case 'PLAYER_DISCONNECT': {
        const playerID = lobbyEvent.player;
        if (!checkType(playerID, 'string')) return;
        setPlayer(playerID, 'DISCONNECTED', false);
        break;
      }
      case 'PLAYER_LEFT': {
        const playerID = lobbyEvent.player;
        if (!checkType(playerID, 'string')) return;
        delete players[playerID];
        break;
      }
      case 'ENTER_PRE_GAME_LOBBY': {
        lobbyScreen.value = 'PRE_GAME';
        break;
      }
      case 'PLAYER_READY': {
        const playerID = lobbyEvent.player;
        if (!checkType(playerID, 'string')) return;
        setPlayer(playerID, 'CONNECTED', true);
        break;
      }
      case 'PLAYER_UNREADY': {
        const playerID = lobbyEvent.player;
        if (!checkType(playerID, 'string')) return;
        setPlayer(playerID, 'CONNECTED', false);
        break;
      }
      case 'GAME_OVER': {
        const winner = lobbyEvent.winner;
        if (checkType(winner, 'string')) lastWinner.value = winner;
        else if (checkType(winner, 'null')) lastWinner.value = null;
        lobbyScreen.value = 'POST_GAME';
        break;
      }
    }
  });

  return { players: players, lastWinner: lastWinner, lobbyScreen: lobbyScreen };
}
