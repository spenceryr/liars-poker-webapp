
// TODO: (spencer) Use a protocol buffer package.

var LOBBY_EVENTS = {
  LOBBY_JOIN: 0,
  LOBBY_CREATE: 1,
  LOBBY_LEAVE: 2,
  LOBBY_START_GAME: 3
};
module.exports.LOBBY_EVENTS = LOBBY_EVENTS;

var LOBBY_EVENT_REQS = (() => {
  let r = {};
  r[LOBBY_EVENTS.LOBBY_JOIN] = class LobbyJoinReq {
    constructor(playerID) {
      this.playerID = playerID;
    }
  }
  // TODO: (spencer) Implement lobbies.
  r[LOBBY_EVENTS.LOBBY_CREATE] = class LobbyCreateReq {
    constructor() {
    }
  }
  return r;
})();
module.exports.LOBBY_EVENT_REQS = LOBBY_EVENT_REQS;

var GAME_EVENTS = {
  GAME_PLAYER_CALLED: 0,
  GAME_PLAYER_PROPOSE_HAND: 1
}
module.exports.GAME_EVENTS = GAME_EVENTS;
