import { Player } from "./player";
import { ClientDataStore } from "./client-data";
import { GAME_EVENT, Game } from "./game";
import { Card } from "./card";
import { PlayerCustomHand } from "./player-custom-hand";
import { StateMachine } from "./state-machine";

/**
 * @typedef {import("./client-data").ClientID} ClientID
 */

/**
 * @typedef {string} LobbyID
 */

export class Lobby {
  constructor(lobbyID, password) {
    /** @type {ClientID[]} */
    this.clients = [];
    /** @type {LobbyID} */
    this.lobbyID = lobbyID;
    this.lobbyPassword = password;
    this.game = null;
    /** @type {ClientID?} */
    this.lastWinner = null;
    this.stateMachine = new LobbyStateMachine();
    this.stateMachine.emitter.on("state_change", (state) => {
      if (state !== LobbyStateMachine.LOBBY_STATES.PRE_GAME) return;
      // Remove disconnected clients.
      this.clients
        .map((clientID) => ClientDataStore.get(clientID))
        .filter((clientData) => clientData.disconnected)
        .forEach((clientData) => this.clientLeft(clientData.clientID));
      this.sendToAllClients(JSON.stringify({
        type: "LOBBY_EVENT.ENTER_PRE_GAME_LOBBY",
      }));
    });
    /** @type {Map<ClientID, NodeJS.Timeout>} */
    this.clientTimeouts = new Map();
  }

  /**
   *
   * @param {ClientID} clientID
   * @returns
   */
  clientJoined(clientID) {
    if (!this.acceptingNewPlayers) return false;
    let clientData = ClientDataStore.get(clientID);
    if (!clientData) return;
    clientData.player = new Player(clientID);
    clientData.lobbyID = this.lobbyID;
    this.sendToAllClients(JSON.stringify({
      type: "LOBBY_EVENT.PLAYER_JOINED",
      player: clientData.player.playerID,
    }));
    return true;
  }

  /**
   *
   * @param {ClientID} clientID
   * @returns
   */
  clientLeft(clientID) {
    let clientIndex = this.clientIndex(clientID);
    if (clientIndex === -1) { return }
    this.clients.splice(clientIndex, 1);
    let clientData = ClientDataStore.get(clientID);
    if (!clientData) return;
    clientData.lobbyID = null;
    clientData.player = null;
    let timeout = this.clientTimeouts.get(clientID);
    if (timeout) {
      clearTimeout(timeout);
      this.clientTimeouts.delete(clientID);
    }
    if (this.clients.length === 0) {
      destroyThis();
      return;
    }
    this.sendToAllClients(JSON.stringify({
      type: "LOBBY_EVENT.PLAYER_LEFT",
      player: clientData.player.playerID
    }));
    if (this.inGame) {
      this.game.startNextRoundOrEndGame(true);
    }
  }

  destroyThis() {
    this.stopListenForGameEvents();
    this.stateMachine.emitter.removeAllListeners();
    LobbyDataStore.delete(this.lobbyID);
  }

  /**
   *
   * @param {ClientID} clientID
   */
  clientDisconnect(clientID) {
    if (this.clientIndex(clientID) === -1) { return }
    let clientData = ClientDataStore.get(clientID);
    if (!clientData) return;
    clientData.player.ready = false;
    this.sendToAllClients(JSON.stringify({
      type: "LOBBY_EVENT.PLAYER_DISCONNECT",
      player: clientData.player.playerID
    }));
    // Ignore post game client leaves to give them infinite time to connect before the game starts.
    // Will cull once game starts or enter pre game lobby.
    if (this.stateMachine.verifyState(LobbyStateMachine.LOBBY_STATES.POST_GAME)) return;
    // Give 1 minute for client to reconnect if in game.
    if (this.inGame) {
      this.clientTimeouts.set(
        clientID,
        setTimeout((clientID) => {
          let clientData = ClientDataStore.get(clientID);
          if (clientData && !clientData.disconnected) return;
          this.clientLeft(clientID);
        }, 60 * 1000, clientID)
      )
    } else {
      this.clientLeft(clientData);
    }
  }

  /**
   *
   * @param {ClientID} clientID
   */
  clientReconnected(clientID) {
    if (this.clientIndex(clientID) === -1) return;
    let timeout = this.clientTimeouts.get(clientID);
    if (timeout) {
      clearTimeout(timeout);
      this.clientTimeouts.delete(clientID);
    }
    let clientData = ClientDataStore.get(clientID);
    if (!clientData) return;
    this.sendToAllClients(JSON.stringify({
      type: "LOBBY_EVENT.PLAYER_RECONNECT",
      player: clientData.player.playerID,
    }));
  }

  /**
   *
   * @param {ClientID} clientID
   * @returns
   */
  clientReady(clientID) {
    if (this.clientIndex(clientID) === -1) return;
    let clientData = ClientDataStore.get(clientID);
    if (!clientData || clientData.player.ready) return;
    this.sendToAllClients(JSON.stringify({
      type: "LOBBY_EVENT.PLAYER_READY",
      player: clientData.player.playerID
    }));
    this.checkReadyStates();
  }

  /**
   *
   * @param {ClientID} clientID
   * @returns
   */
  clientUnReady(clientID) {
    if (this.clientIndex(clientID) === -1) return;
    let clientData = ClientDataStore.get(clientID);
    if (!clientData || !clientData.player.ready) return;
    this.sendToAllClients(JSON.stringify({
      type: "LOBBY_EVENT.PLAYER_UNREADY",
      player: clientData.player.playerID
    }));
  }

  checkReadyStates() {
    // TODO: (spencer) Better logic.
    // Check if all connected clients ready.
    // If there are disconnected clients, wait 10 seconds before starting.
    // If they reconnect within those 10 seconds, stop timer.
    // Set up ultimate timer that starts the game within 60 seconds of anyone being ready.
    // Stop this timer if no one is ready.
    // Only start game if num players >= 2
    // Call this when players ready or unready(?).
    if (this.clients.every((clientID) => ClientDataStore.get(clientID).player.ready)) this.startGame();
  }

  /**
   *
   * @param {ClientID} clientID
   * @returns {number}
   */
  clientIndex(clientID) {
    return this.clients.findIndex(clientID);
  }

  get acceptingNewPlayers() {
    return this.clients.length <= Game.MAX_PLAYERS && this.stateMachine.verifyState(LobbyStateMachine.LOBBY_STATES.PRE_GAME);
  }

  returnToPreGameLobby() {
    if (!this.stateMachine.verifyState(LobbyStateMachine.LOBBY_STATES.POST_GAME)) return;
    this.stateMachine.transition(LobbyStateMachine.LOBBY_STATES.PRE_GAME);
  }

  startGame() {
    if (this.inGame) return;
    if (this.startGameTimer) {
      clearTimeout(this.startGameTimer.timeout);
      this.startGameTimer = null;
    }
    /** @type {Player} */
    let startingPlayer = null;
    let removeClients = this.clients
      .map((clientID) => ClientDataStore.get(clientID))
      .filter((clientData) => clientData.disconnected || !clientData.player.ready);
    for (const clientID in removeClients) this.clientLeft(clientID);
    this.clientTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.clientTimeouts.clear();
    if (this.clients.length < Game.MIN_PLAYERS || this.clients.length > Game.MAX_PLAYERS) {
      this.stateMachine.transition(LobbyStateMachine.LOBBY_STATES.PRE_GAME);
      return;
    }
    if (this.lastWinner) startingPlayer = ClientDataStore.get(this.lastWinner);
    let players = this.clients.map((clientID) => ClientDataStore.get(clientID).player);
    shuffleArray(players);
    if (!startingPlayer) startingPlayer = players[Math.floor(Math.random() * players.length)];
    this.game = new Game(players, startingPlayer);
    this.listenForGameEvents();
    if (!this.game.start()) {
      this.stopListenForGameEvents();
      this.game = null;
      this.stateMachine.transition(LobbyStateMachine.LOBBY_STATES.PRE_GAME);
      return;
    }
    this.stateMachine.transition(LobbyStateMachine.LOBBY_STATES.IN_GAME);
  }

  get inGame() {
    return this.stateMachine.verifyState(LobbyStateMachine.LOBBY_STATES.IN_GAME)
  }

  listenForGameEvents() {
    this.game.emitter.on(GAME_EVENT.SETUP, this.gameEventHandlers[GAME_EVENT.SETUP]);
    this.game.emitter.on(GAME_EVENT.PLAYER_TURN, this.gameEventHandlers[GAME_EVENT.PLAYER_TURN]);
    this.game.emitter.on(GAME_EVENT.PLAYER_PROPOSE_HAND, this.gameEventHandlers[GAME_EVENT.PLAYER_PROPOSE_HAND]);
    this.game.emitter.on(GAME_EVENT.REVEAL, this.gameEventHandlers[GAME_EVENT.REVEAL]);
    this.game.emitter.on(GAME_EVENT.GAME_OVER, this.gameEventHandlers[GAME_EVENT.GAME_OVER]);
  }

  stopListenForGameEvents() {
    this.game.emitter.off(GAME_EVENT.SETUP, this.gameEventHandlers[GAME_EVENT.SETUP]);
    this.game.emitter.off(GAME_EVENT.PLAYER_TURN, this.gameEventHandlers[GAME_EVENT.PLAYER_TURN]);
    this.game.emitter.off(GAME_EVENT.PLAYER_PROPOSE_HAND, this.gameEventHandlers[GAME_EVENT.PLAYER_PROPOSE_HAND]);
    this.game.emitter.off(GAME_EVENT.REVEAL, this.gameEventHandlers[GAME_EVENT.REVEAL]);
    this.game.emitter.off(GAME_EVENT.GAME_OVER, this.gameEventHandlers[GAME_EVENT.GAME_OVER]);
  }

  gameEventHandlers = {
    /**
     *
     * @param {Player[]} players
     */
    [GAME_EVENT.SETUP]: (players) => {
      players.forEach((player) => {
        try {
          ClientDataStore.get(player.clientID).ws.send(JSON.stringify({
            type: "GAME_EVENT.SETUP",
            cards: player.cards.map((card) => cardToObj(card))
          }));
        } catch (e) {
          console.error(e);
        }
      });
      this.game.playerStartTurn();
    },
    /**
     *
     * @param {Player} player
     */
    [GAME_EVENT.PLAYER_TURN]: (player) => {
      this.sendToAllClients(JSON.stringify({
        type: "GAME_EVENT.PLAYER_TURN",
        player: player.playerID
      }));
    },
    /**
     *
     * @param {{player: Player, proposedHand: PlayerCustomHand}}
     */
    [GAME_EVENT.PLAYER_PROPOSE_HAND]: ({player, proposedHand}) => {
      this.sendToAllClients(JSON.stringify({
        type: "GAME_EVENT.PLAYER_PROPOSE_HAND",
        player: player.playerID,
        proposedHand: proposedHand.cards.map((card) => cardToObj(card)),
      }));
      this.game.playerStartTurn();
    },
    /**
     *
     * @param {{loser: Player, winner: Player}}
     */
    [GAME_EVENT.REVEAL]: ({loser, winner}) => {
      this.sendToAllClients(JSON.stringify({
        type: "GAME_EVENT.REVEAL",
        playersCards: this.clients
          .map((clientID) => ClientDataStore.get(clientID).player)
          .reduce(
            (acc, curr) => Object.assign(acc, { [curr.playerID]: curr.cards.map((card) => cardToObj(card)) }),
            {}
          ),
        loser: loser.playerID,
        winner: winner.playerID,
      }));
      this.game.startNextRoundOrEndGame();
    },
    /**
     *
     * @param {Player?} winner
     */
    [GAME_EVENT.GAME_OVER]: (winner) => {
      this.game = null;
      this.stopListenForGameEvents();
      let winnerID = null;
      if (winner) {
        this.lastWinner = winner.clientID;
        winnerID = winner.playerID;
      } else {
        this.lastWinner = null;
      }
      this.sendToAllClients(JSON.stringify({
        // TODO: (spencer) Maybe include reason why game ended?
        type: "GAME_EVENT.GAME_OVER",
        winner: winnerID,
      }));
      this.stateMachine.transition(LobbyStateMachine.LOBBY_STATES.POST_GAME);
    }
  }

  sendToAllClients(data) {
    Array.from(this.playerIDToClientMap.values()).map((client) => client.clientData).forEach((client) => {
      try {
        client.ws.send(data);
      } catch (e) {
        console.error(e);
      }
    });
  }
}

class LobbyStateMachine {
  constructor() {
    let states = {};
    for (const state in LOBBY_STATES) {
      if (!LobbyStateMachine.LOBBY_STATES.hasOwnProperty(state)) return;
      states[state] = {
        transitions: LobbyStateMachine.VALID_TRANSITIONS[state],
      };
    }
    /** @type {StateMachine} */
    this.stateMachine = new StateMachine(states, LobbyStateMachine.LOBBY_STATES.PRE_GAME);
    this.emitter = this.stateMachine.emitter;
  }

  static LOBBY_STATES = {
    PRE_GAME: "PRE_GAME",
    IN_GAME: "IN_GAME",
    POST_GAME: "POST_GAME",
  };

  static VALID_TRANSITIONS = (() => {
    const LOBBY_STATES = this.LOBBY_STATES;
    let t = {};
    t[LOBBY_STATES.PRE_GAME] = [LOBBY_STATES.IN_GAME];
    t[LOBBY_STATES.IN_GAME] = [LOBBY_STATES.POST_GAME];
    t[LOBBY_STATES.POST_GAME] = [LOBBY_STATES.PRE_GAME, LOBBY_STATES.IN_GAME];
    return t;
  })();

  transition(nextState) {
    return this.stateMachine.transition(nextState);
  }

  verifyState(...states) {
    this.stateMachine.verifyState(...states);
  }
}


function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 *
 * @param {Card} card
 */
function cardToObj(card) {
  return { value: card.value, suit: card.suit };
}

export class LobbyDataStore {
  /** @type {Map<LobbyID, Lobby>} */
  static lobbyMapping = new Map();

  /**
   *
   * @param {LobbyID} lobbyID
   * @param {Lobby} lobby
   */
  static set(lobbyID, lobby) {
    this.lobbyMapping.set(lobbyID, lobby)
  }

  /**
   *
   * @param {LobbyID} lobbyID
   * @returns {boolean}
   */
  static delete(lobbyID) {
    return this.lobbyMapping.delete(lobbyID);
  }

  /**
   *
   * @param {lobbyID} clientID
   * @returns {Lobby | undefined}
   */
  static get(lobbyID) {
    return this.lobbyMapping.get(lobbyID);
  }
}
