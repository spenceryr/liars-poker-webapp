import { watch, ref, shallowRef, toValue } from "vue";
import { checkType, checkTypes } from "/@/utilities/checkType";

export function useLobby(lobbyEvent) {
  /** @type {import("vue").Ref<Object<string, { connection: string, ready: boolean, username: string }>>} */
  const playersInfo = ref({});
  /** @type {import("vue").Ref<Boolean>} */
  const inGame = shallowRef(false);

  function setPlayer(playerID, connection, ready) {
    if (!playersInfo.value[playerID]) {
      console.error("Couldn't set player; missing from playersInfo");
      return;
    }
    const username = playersInfo.value[playerID].username;
    const playerInfo = { connection: connection, ready: ready, username: username };
    playersInfo.value[playerID] = playerInfo;
  }

  function createPlayer(playerID, username) {
    const playerInfo = { connection: 'CONNECTING', ready: false, username: username };
    playersInfo.value[playerID] = playerInfo;
  }

  watch(lobbyEvent, (newLobbyEvent) => {
    const lobbyEvent = toValue(newLobbyEvent);
    if (!lobbyEvent) return;
    if (!checkTypes([lobbyEvent, lobbyEvent.event], ['object', 'string'])) return;
    switch (lobbyEvent.event) {
      case 'INITIALIZE': {
        const snapshot = lobbyEvent.snapshot;
        if (!checkType(snapshot, 'object')) return;
        const snapPlayers = snapshot.playerSnapshots;
        const snapLobbyState = snapshot.lobbyState;
        if (!checkTypes([snapPlayers, snapLobbyState], ['object', 'string'])) return;
        console.debug(`Lobby processing INITIALIZE`);
        // TODO: (spencer) Maybe validate the object more.
        playersInfo.value = snapPlayers;
        inGame.value = snapLobbyState === 'IN_GAME' || snapLobbyState === 'POST_GAME';
        break;
      }
      case 'PLAYER_CONNECT': {
        const playerID = lobbyEvent.player;
        if (!checkType(playerID, 'string')) return;
        console.debug(`Lobby processing PLAYER_CONNECT ${playerID}`);
        setPlayer(playerID, 'CONNECTED', false);
        break;
      }
      case 'PLAYER_JOINED': {
        const playerID = lobbyEvent.player;
        const username = lobbyEvent.username;
        if (!checkType(playerID, 'string')) return;
        console.debug(`Lobby processing PLAYER_JOINED ${playerID}`);
        createPlayer(playerID, username);
        break;
      }
      case 'PLAYER_DISCONNECT': {
        const playerID = lobbyEvent.player;
        if (!checkType(playerID, 'string')) return;
        console.debug(`Lobby processing PLAYER_DISCONNECT ${playerID}`);
        setPlayer(playerID, 'DISCONNECTED', false);
        break;
      }
      case 'PLAYER_LEFT': {
        const playerID = lobbyEvent.player;
        if (!checkType(playerID, 'string')) return;
        console.debug(`Lobby processing PLAYER_LEFT ${playerID}`);
        delete playersInfo.value[playerID];
        break;
      }
      case 'ENTER_PRE_GAME_LOBBY': {
        console.debug(`Lobby processing ENTER_PRE_GAME_LOBBY`);
        inGame.value = false;
        break;
      }
      case 'PLAYER_READY': {
        const playerID = lobbyEvent.player;
        if (!checkType(playerID, 'string')) return;
        console.debug(`Lobby processing PLAYER_READY ${playerID}`);
        setPlayer(playerID, 'CONNECTED', true);
        break;
      }
      case 'PLAYER_UNREADY': {
        const playerID = lobbyEvent.player;
        if (!checkType(playerID, 'string')) return;
        console.debug(`Lobby processing PLAYER_UNREADY ${playerID}`);
        setPlayer(playerID, 'CONNECTED', false);
        break;
      }
      case 'GAME_START': {
        console.debug(`Lobby processing GAME_START`);
        for (const playerID in playersInfo.value) setPlayer(playerID, playersInfo.value[playerID].connection, false);
        inGame.value = true;
        break;
      }
    }
  }, { immediate: true });

  return { playersInfo, inGame };
}
