"use strict";
import { Player } from "./player.js";
import { ClientDataStore } from "./client-data.js";
import { GAME_EVENT, Game } from "./game.js";
import { StateMachine } from "./state-machine.js";

/**
 * @typedef {import("./client-data").ClientID} ClientID
 * @typedef {import("./client-data").ClientData} ClientData
 * @typedef {import("./player-custom-hand.js").PlayerCustomHand} PlayerCustomHand
 */

/**
 * @typedef {string} LobbyID
 */

// TODO: (spencer) Start destroy timeout when lobby created (maybe with longer timeout).
export class Lobby {
  /**
   *
   * @param {LobbyID} lobbyID
   * @param {string} password
   */
  constructor(lobbyID, password) {
    /** @type {Set<ClientID>} */
    this.clientIDs = new Set();
    /** @type {LobbyID} */
    this.lobbyID = lobbyID;
    this.lobbyPassword = password;
    this.game = null;
    /** @type {ClientID?} */
    this.lastWinner = null;
    this.stateMachine = new LobbyStateMachine();
    this.stateMachine.emitter.on("state_change", (function onStateChange(state) {
      if (state !== LobbyStateMachine.LOBBY_STATES.PRE_GAME) return;
      if (this.game) {
        this.stopListenForGameEvents();
        this.game = null;
      }
      // Remove disconnected clients.
      this.clients
        .filter((client) => client.isDisconnected)
        .forEach((client) => this.clientLeft(client));
      this.lastWinner = null;
      this.sendToAllClients(JSON.stringify({
        type: "LOBBY_EVENT",
        event: "ENTER_PRE_GAME_LOBBY",
      }));
    }).bind(this));
    /** @type {Map<ClientID, NodeJS.Timeout>} */
    this.clientTimeouts = new Map();
    /** @type {NodeJS.Timeout?} */
    this.destroyTimeout = null;
  }

  /**
   * @type {ClientData[]}
   */
  get clients() {
    return Array.from(this.clientIDs.entries()).map(([clientID, ..._]) => ClientDataStore.get(clientID)).filter((client) => !!client);
  }

  getLobbySnapshot() {
    // TODO: (spencer) Create class.
    return {
      playerSnapshots: this.clients.reduce(
        (acc, curr) => Object.assign(acc, {
          [curr.player.playerID]: {
            connection: curr.isConnected ? 'CONNECTED' : (curr.isDisconnected ? 'DISCONNECTED' : 'CONNECTING'),
            ready: curr.player.ready
          }
        }),
        {}
      ),
      lastWinner: this.lastWinner,
      lobbyState: this.stateMachine.state
    }
  }

  /**
   *
   * @param {ClientData} client
   * @returns {boolean}
   */
  clientJoined(client) {
    if (this.clientIDs.has(client.clientID)) return true;
    if (!this.acceptingNewPlayers) return false;
    if (this.destroyTimeout) clearTimeout(this.destroyTimeout);
    client.player = new Player(client.clientID);
    client.lobbyID = this.lobbyID;
    console.debug(`Lobby ${this.lobbyID} client ${client.clientID} joined with playerID: ${client.player.playerID}!`);
    this.sendToAllClients(JSON.stringify({
      type: "LOBBY_EVENT",
      event: "PLAYER_JOINED",
      player: client.player.playerID,
    }));
    // Client has 30 seconds to connect before being dropped from lobby. This will not be refreshed if
    // client tries to join again before connection is established.
    this.clientTimeouts.set(client.clientID, setTimeout((client) => {
      if (client.isConnected) return;
      this.clientLeft(client);
    }, 30 * 1000, client));
    this.clientIDs.add(client.clientID);
    return true;
  }

  /**
   *
   * @param {ClientData} client
   * @returns
   */
  clientLeft(client) {
    if (!this.clientIDs.has(client.clientID)) return;
    console.debug(`Lobby ${this.lobbyID} client ${client.clientID} left`);
    this.clientIDs.delete(client.clientID);
    let playerID = client.player.playerID;
    client.player = null;
    client.lobbyID = null;
    if (client.clientID === this.lastWinner) this.lastWinner = null;
    let timeout = this.clientTimeouts.get(client.clientID);
    if (timeout) {
      clearTimeout(timeout);
      this.clientTimeouts.delete(client.clientID);
    }
    if (this.clientIDs.size === 0) {
      this.destroyThis();
      return;
    }
    this.sendToAllClients(JSON.stringify({
      type: "LOBBY_EVENT",
      event: "PLAYER_LEFT",
      player: playerID
    }));
    // TODO: (spencer) Only end game if player still had cards.
    if (this.inGame) {
      this.game.startNextRoundOrEndGame(true);
    }
  }

  destroyThis() {
    console.debug(`Lobby ${this.lobbyID} destroyed`);
    this.clientIDs.clear();
    if (this.destroyTimeout) clearTimeout(this.destroyTimeout);
    for (const timeout of this.clientTimeouts) clearTimeout(timeout);
    if (this.game) {
      this.stopListenForGameEvents();
      this.game = null;
    }
    this.stateMachine.emitter.removeAllListeners();
    LobbyStore.delete(this.lobbyID);
  }

  /**
   *
   * @param {ClientData} client
   */
  clientDisconnect(client) {
    if (!this.clientIDs.has(client.clientID)) return;
    console.debug(`Lobby ${this.lobbyID} client ${client.clientID} disconnect`);
    client.player.ready = false;
    this.sendToAllClients(JSON.stringify({
      type: "LOBBY_EVENT",
      event: "PLAYER_DISCONNECT",
      player: client.player.playerID
    }));
    // Give 1 minute for client to reconnect if in game.
    if (this.inGame) {
      this.clientTimeouts.set(
        client.clientID,
        setTimeout((client) => {
          if (!client.isDisconnected && !client.isDisconnecting) return;
          this.clientLeft(client);
        }, 60 * 1000, client)
      );
    } else if (this.stateMachine.verifyState(LobbyStateMachine.LOBBY_STATES.POST_GAME)) {
      let numConnectedClients = this.clients.filter((client) => {
        return !client.isDisconnected && !client.isDisconnecting;
      }).length;
      // Destroy this object if all clients disconnected for 1 minute.
      // Otherwise ignore post game client leaves to give them infinite time to connect before the game starts.
      // Will cull once game starts or enter pre game lobby.
      if (numConnectedClients <= 0) {
        this.destroyTimeout = setTimeout(() => this.destroyThis(), 60 * 1000);
      }
    } else {
      // TODO: (spencer) Maybe don't immediately remove (incase they refresh page).
      this.clientLeft(client);
    }
  }

  /**
   *
   * @param {ClientData} client
   * @returns {boolean}
   */
  clientConnected(client) {
    if (!this.clientIDs.has(client.clientID)) return false;
    console.debug(`Lobby ${this.lobbyID} client ${client.clientID} connected`);
    let timeout = this.clientTimeouts.get(client.clientID);
    if (timeout) {
      clearTimeout(timeout);
      this.clientTimeouts.delete(client.clientID);
    }
    if (this.destroyTimeout) clearTimeout(this.destroyTimeout);
    this.sendToAllClients(JSON.stringify({
      type: "LOBBY_EVENT",
      event: "PLAYER_CONNECT",
      player: client.player.playerID,
    }));
    return true;
  }

  /**
   *
   * @param {ClientData} client
   * @returns
   */
  clientReady(client) {
    if (this.inGame) return;
    if (!this.clientIDs.has(client.clientID)) return;
    if (client.player.ready) return;
    client.player.ready = true;
    console.debug(`Lobby ${this.lobbyID} client ${client.clientID} ready`);
    this.sendToAllClients(JSON.stringify({
      type: "LOBBY_EVENT",
      event: "PLAYER_READY",
      player: client.player.playerID
    }));
    this.checkReadyStates();
  }

  /**
   *
   * @param {ClientData} client
   * @returns
   */
  clientUnReady(client) {
    if (!this.clientIDs.has(client.clientID)) return;
    if (!client.player.ready) return;
    client.player.ready = false;
    console.debug(`Lobby ${this.lobbyID} client ${client.clientID} unready`);
    this.sendToAllClients(JSON.stringify({
      type: "LOBBY_EVENT",
      event: "PLAYER_UNREADY",
      player: client.player.playerID
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
    // TODO: (spencer) Add countdown before starting.
    if (this.clients.every((client) => client.player.ready)) this.startGame();
  }

  get acceptingNewPlayers() {
    let hasMaxPlayers = this.clientIDs.size >= Game.MAX_PLAYERS;
    let inPreGame = this.stateMachine.verifyState(LobbyStateMachine.LOBBY_STATES.PRE_GAME);
    return !hasMaxPlayers && inPreGame;
  }

  returnToPreGameLobby() {
    // TODO: (spencer) Maybe allow this during game?
    if (!this.stateMachine.verifyState(LobbyStateMachine.LOBBY_STATES.POST_GAME)) return;
    console.debug(`Lobby ${this.lobbyID} return to pre game lobby`);
    this.stateMachine.transition(LobbyStateMachine.LOBBY_STATES.PRE_GAME);
  }

  startGame() {
    if (this.inGame) return;
    console.debug(`Lobby ${this.lobbyID} starting game`);
    // Cleanup clients, so don't use `clients`.
    this.clientIDs.forEach((clientID) => {
      let client = ClientDataStore.get(clientID);
      if (!client || !client.isConnected || !client.player.ready) this.clientLeft(client);
    });
    if (this.clientIDs.size < Game.MIN_PLAYERS || this.clientIDs.size > Game.MAX_PLAYERS) {
      this.stateMachine.transition(LobbyStateMachine.LOBBY_STATES.PRE_GAME);
      console.debug(`Lobby ${this.lobbyID} could not start game: invalid player amount`);
      return;
    }
    /** @type {Player} */
    let startingPlayer = null;
    if (this.lastWinner) startingPlayer = ClientDataStore.get(this.lastWinner).player;
    let players = this.clients.map((client) => client.player);
    shuffleArray(players);
    if (!startingPlayer || !players.includes(startingPlayer)) startingPlayer = players[Math.floor(Math.random() * players.length)];
    // Makes sure player order starts with starting player
    while (players[0] !== startingPlayer) {
      players.push(players.shift());
    }
    if (this.game) this.stopListenForGameEvents();
    this.game = new Game(players);
    this.listenForGameEvents();
    if (!this.game.start()) {
      console.debug(`Lobby ${this.lobbyID} start game failed`);
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
    for (const event in GAME_EVENT) {
      this.game.emitter.on(event, this.gameEventHandlers[event]);
    }
  }

  stopListenForGameEvents() {
    for (const event in GAME_EVENT) {
      this.game.emitter.off(event, this.gameEventHandlers[event]);
    }
  }

  gameEventHandlers = {
    [GAME_EVENT.GAME_START]: (function onGameStart() {
      console.debug(`Lobby ${this.lobbyID} received game start event`);
      this.clients.forEach((client) => client.player.ready = false);
      this.sendToAllClients(JSON.stringify({
        type: "LOBBY_EVENT",
        event: "GAME_START"
      }));
    }).bind(this),
    /**
     *
     * @param {Player[]} players
     */
    [GAME_EVENT.SETUP]: (function onGameSetup(players) {
      console.debug(`Lobby ${this.lobbyID} received setup game event`);
      players.forEach((player) => {
        try {
          ClientDataStore.get(player.clientID).sendMessage(JSON.stringify({
            type: "GAME_EVENT",
            event: "SETUP",
            playerHand: player.cards.map((card) => card.toObj()),
            playersOrder: players.map((player) => player.playerID),
            playersNumCards: players.reduce((acc, curr) => Object.assign(acc, { [curr.playerID]: curr.numCards }), {}),
          }));
        } catch (e) {
          console.error(e);
        }
      });
      this.game.playerStartTurn();
    }).bind(this),
    /**
     *
     * @param {Player} player
     */
    [GAME_EVENT.PLAYER_TURN]: (function onGamePlayerTurn(player) {
      console.debug(`Lobby ${this.lobbyID} received player turn game event`);
      this.sendToAllClients(JSON.stringify({
        type: "GAME_EVENT",
        event: "PLAYER_TURN",
        player: player.playerID
      }));
    }).bind(this),
    /**
     *
     * @param {{player: Player, proposedHand: PlayerCustomHand}}
     */
    [GAME_EVENT.PLAYER_PROPOSE_HAND]: (function onGamePlayerProposeHand({player, proposedHand}) {
      console.debug(`Lobby ${this.lobbyID} received player propose hand game event`);
      this.sendToAllClients(JSON.stringify({
        type: "GAME_EVENT",
        event: "PLAYER_PROPOSE_HAND",
        player: player.playerID,
        proposedHand: proposedHand.cards.map((card) => card.toObj()),
      }));
      this.game.playerStartTurn();
    }).bind(this),
    /**
     *
     * @param {{loser: Player, winner: Player}}
     */
    [GAME_EVENT.REVEAL]: (function onGameReveal({loser, winner}) {
      console.debug(`Lobby ${this.lobbyID} received reveal game event`);
      this.sendToAllClients(JSON.stringify({
        type: "GAME_EVENT",
        event: "REVEAL",
        allPlayersCards: this.clients
          .map((client) => client.player)
          .reduce(
            (acc, curr) => Object.assign(acc, { [curr.playerID]: curr.cards.map((card) => card.toObj()) }),
            {}
          ),
        loser: loser.playerID,
        winner: winner.playerID,
      }));
      this.game.startNextRoundOrEndGame();
    }).bind(this),
    /**
     *
     * @param {Player?} winner
     */
    [GAME_EVENT.GAME_OVER]: (function onGameGameOver(winner) {
      console.debug(`Lobby ${this.lobbyID} received game over game event`);
      this.lastWinner = winner?.clientID ?? null;
      this.sendToAllClients(JSON.stringify({
        // TODO: (spencer) Maybe include reason why game ended?
        type: "GAME_EVENT",
        event: "GAME_OVER",
        winner: winner?.playerID ?? null,
      }));
      this.stateMachine.transition(LobbyStateMachine.LOBBY_STATES.POST_GAME);
    }).bind(this)
  }

  sendToAllClients(data) {
    console.debug(`Lobby ${this.lobbyID} sending msg to all clients: ${JSON.stringify(data)}`);
    this.clients.forEach((client) => {
      try {
        client.sendMessage(data);
      } catch (e) {
        console.error(e);
      }
    });
  }
}

class LobbyStateMachine {
  constructor() {
    let states = {};
    for (const state in LobbyStateMachine.LOBBY_STATES) {
      if (!Object.prototype.hasOwnProperty.call(LobbyStateMachine.LOBBY_STATES, state)) return;
      let stateValue = LobbyStateMachine.LOBBY_STATES[state];
      states[stateValue] = {
        transitions: LobbyStateMachine.VALID_TRANSITIONS[stateValue],
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
    return this.stateMachine.verifyState(...states);
  }

  get state() { return this.stateMachine.state; }
}


function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
  }
}

export const LobbyStore = {
  /** @type {Map<LobbyID, Lobby>} */
  lobbyMapping: new Map(),

  /**
   *
   * @param {LobbyID} lobbyID
   * @param {Lobby} lobby
   */
  set(lobbyID, lobby) {
    this.lobbyMapping.set(lobbyID, lobby)
  },

  /**
   *
   * @param {LobbyID} lobbyID
   * @returns {boolean}
   */
  delete(lobbyID) {
    return this.lobbyMapping.delete(lobbyID);
  },

  /**
   *
   * @param {LobbyID} lobbyID
   * @returns {Lobby | undefined}
   */
  get(lobbyID) {
    return this.lobbyMapping.get(lobbyID);
  },

  entries() {
    return this.lobbyMapping.entries();
  },

  get size() {
    return this.lobbyMapping.size;
  }
}
