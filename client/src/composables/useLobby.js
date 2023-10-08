import { watch, ref, shallowRef, toValue } from "vue";
import { checkType, checkTypes } from "/@/utilities/checkType";

export function useLobby(lobbyEvent) {
  let players = ref({});
  let lastWinner = shallowRef(null);
  let lobbyScreen = shallowRef(null);

  function setPlayer(playerID, connection, ready) {
    let playerInfo = { connection: connection, ready: ready };
    players.value[playerID] = playerInfo;
  }

  watch(lobbyEvent, (newLobbyEvent) => {
    let lobbyEvent = toValue(newLobbyEvent);
    if (!checkTypes([lobbyEvent, lobbyEvent.event], ['object', 'string'])) return;
    switch (lobbyEvent.event) {
      case 'INITIALIZE': {
        let snapshot = lobbyEvent.snapshot;
        if (!checkType(snapshot, 'object')) return;
        let snapPlayers = snapshot.playerSnapshots;
        let snapLastWinner = snapshot.lastWinner;
        let snapLobbyState = snapshot.lobbyState;
        if (!checkTypes([snapPlayers, snapLastWinner, snapLobbyState], ['object', 'string', 'string'])) return;
        // TODO: (spencer) Maybe validate the object more.
        players.value = snapPlayers;
        lastWinner.value = snapLastWinner;
        lobbyScreen.value = snapLobbyState;
        break;
      }
      case 'PLAYER_CONNECT': {
        let playerID = lobbyEvent.player;
        if (!checkType(playerID, 'string')) return;
        setPlayer(playerID, 'CONNECTED', false);
        break;
      }
      case 'PLAYER_JOINED': {
        let playerID = lobbyEvent.player;
        if (!checkType(playerID, 'string')) return;
        setPlayer(playerID, 'DISCONNECTED', false);
        break;
      }
      case 'PLAYER_DISCONNECT': {
        let playerID = lobbyEvent.player;
        if (!checkType(playerID, 'string')) return;
        setPlayer(playerID, 'DISCONNECTED', false);
        break;
      }
      case 'PLAYER_LEFT': {
        let playerID = lobbyEvent.player;
        if (!checkType(playerID, 'string')) return;
        delete lobbyState.value.players[playerID];
        break;
      }
      case 'ENTER_PRE_GAME_LOBBY': {
        lobbyScreen.value = 'PRE_GAME';
        break;
      }
      case 'PLAYER_READY': {
        let playerID = lobbyEvent.player;
        if (!checkType(playerID, 'string')) return;
        setPlayer(playerID, 'CONNECTED', true);
        break;
      }
      case 'PLAYER_UNREADY': {
        let playerID = lobbyEvent.player;
        if (!checkType(playerID, 'string')) return;
        setPlayer(playerID, 'CONNECTED', false);
        break;
      }
      case 'GAME_OVER': {
        let winner = lobbyEvent.winner;
        if (checkType(winner, 'string')) lastWinner.value = winner;
        else if (checkType(winner, 'null')) lastWinner.value = null;
        lobbyScreen.value = 'POST_GAME';
        break;
      }
    }
  });

  return { players, lastWinner, lobbyScreen };
}
