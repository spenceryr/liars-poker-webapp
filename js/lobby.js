import { randomUUID } from "crypto";
import { Player } from "./player";
import { ClientData } from "./client-data";
import { GAME_EVENT, Game } from "./game";
import { Card } from "./card";
import { PlayerCustomHand } from "./player-custom-hand";
/**
 * @typedef {string} ClientID
 */

/**
 * @typedef {string} PlayerID
 */

/**
 * @typedef {{ clientData: ClientData, player: Player, ready: boolean }} Client
 */

export class Lobby {
  constructor(id, password) {
    /** @type {Map<ClientID, PlayerID>} */
    this.clientIDToPlayerIDMap = new Map();
    /** @type {Map<PlayerID, Client} */
    this.playerIDToClientMap = new Map();
    this.id = id;
    this.lobbyPassword = password;
    this.game = null;
    /** @type {ClientID?} */
    this.lastWinner = null;
    this.stateMachine = new LobbyStateMachine();
    this.clientTimeouts = new Map();
  }

  /**
   *
   * @param {ClientData} clientData
   * @returns
   */
  clientJoined(clientData) {
    if (!this.acceptingNewPlayers) return false;
    let playerID = this.createPlayerID();
    this.playerIDToClientMap.set(playerID, {
      clientData: clientData,
      player: new Player(playerID),
      ready: false
    });
    this.clientIDToPlayerIDMap.set(clientData.clientID, playerID);
    clientData.lobbyID = this.id;
    this.sendToAllClients(JSON.stringify({
      type: "LOBBY_EVENT.PLAYER_JOINED",
      player: playerID
    }));
    return true;
  }

  /**
   *
   * @param {ClientData} clientData
   * @returns
   */
  clientLeft(clientData) {
    let playerID = this.clientIDToPlayerIDMap.get(clientData.clientID);
    if (this.clientIDToPlayerIDMap.delete(clientID) || this.playerIDToClientMap.delete(playerID)) {
      clientData.lobbyID = null;
    }
    this.clientTimeouts.delete(clientData);
    this.sendToAllClients(JSON.stringify({
      type: "LOBBY_EVENT.PLAYER_LEFT",
      player: playerID
    }));
    if (this.inGame) {
      this.game.startNextRoundOrEndGame(true);
    }
  }

  /**
   *
   * @param {ClientData} clientData
   * @param {number} leaveTimeoutSec
   */
  clientDisconnect(clientData) {
    let playerID = this.clientIDToPlayerIDMap.get(clientData.clientID);
    if (playerID === undefined) return;
    let client = this.playerIDToClientMap.get(playerID);
    if (!client) return;
    client.ready = false;
    this.sendToAllClients(JSON.stringify({
      type: "LOBBY_EVENT.PLAYER_DISCONNECT",
      player: playerID
    }));
    // Ignore post game client leaves to give them infinite time to connect before the game starts.
    // Will cull once game starts or enter pre game lobby.
    if (this.stateMachine.verifyState(LobbyStateMachine.LOBBY_STATES.POST_GAME)) return;
    // Give 1 minute for client to reconnect if in game.
    if (this.inGame) {
      this.clientTimeouts.set(
        clientData,
        setTimeout((clientData) => {
          if (!clientData.disconnected) return;
          this.clientLeft(clientData);
        }, 60 * 1000, clientData)
      )
    } else {
      this.clientLeft(clientData);
    }
  }

  /**
   *
   * @param {ClientData} clientData
   */
  clientReconnected(clientData) {
    let playerID = this.clientIDToPlayerIDMap.get(clientData.clientID);
    if (this.clientTimeouts.delete(clientData) && playerID !== undefined) {
      this.sendToAllClients(JSON.stringify({
        type: "LOBBY_EVENT.PLAYER_RECONNECT",
        player: playerID
      }));
    }
  }

  clientReady(clientData) {
    let playerID = this.clientIDToPlayerIDMap.get(clientData.clientID);
    if (playerID === undefined) return;
    let client = this.playerIDToClientMap.get(playerID);
    if (!client || client.ready) return;
    this.sendToAllClients(JSON.stringify({
      type: "LOBBY_EVENT.PLAYER_READY",
      player: playerID
    }));
  }

  shouldStartGame() {
    // Check if all connected clients ready.
    // If there are disconnected clients, wait 10 seconds before starting.
    // If they reconnect within those 10 seconds, stop timer.
    // Set up ultimate timer that starts the game within 60 seconds of anyone being ready.
    // Stop this timer if no one is ready.
    // Only start game if num players >= 2
    // Call this when players ready or unready(?).
  }

  clientUnReady(clientData) {
    let playerID = this.clientIDToPlayerIDMap.get(clientData.clientID);
    if (playerID === undefined) return;
    let client = this.playerIDToClientMap.get(playerID);
    if (!client || !client.ready) return;
    this.sendToAllClients(JSON.stringify({
      type: "LOBBY_EVENT.PLAYER_UNREADY",
      player: playerID
    }));
  }

  createPlayerID() {
    return randomUUID();
  }

  get acceptingNewPlayers() {
    return this.playerIDToClientMap.size <= Game.PLAYERS_MAX && this.stateMachine.verifyState(LobbyStateMachine.LOBBY_STATES.PRE_GAME);
  }

  startGame() {
    if (this.inGame) return;
    /** @type {Player} */
    let startingPlayer = null;
    if (this.lastWinner) startingPlayer = this.playerIDToClientMap.get(this.clientIDToPlayerIDMap.get(this.lastWinner)).player;
    let players = Array.from(this.playerIDToClientMap.values()).map((client) => client.player);
    shuffleArray(players);
    if (!startingPlayer) startingPlayer = players[Math.floor(Math.random() * players.length)];
    this.game = new Game(Array.from(this.clients.values()).map((client) => client.player), startingPlayer);
    this.listenForGameEvents();
    if (!this.game.start()) {
      this.stopListenForGameEvents();
      this.game = null;
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
          this.playerIDToClientMap.get(player.id).clientData.ws.send(JSON.stringify({
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
        player: player.id
      }));
    },
    /**
     *
     * @param {{player: Player, proposedHand: PlayerCustomHand}}
     */
    [GAME_EVENT.PLAYER_PROPOSE_HAND]: ({player, proposedHand}) => {
      /** @type {{player: Player, proposedHand: PlayerCustomHand}} */
      this.sendToAllClients(JSON.stringify({
        type: "GAME_EVENT.PLAYER_PROPOSE_HAND",
        player: player.id,
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
        playersCards: Array.from(this.playerIDToClientMap.values())
                        .map((client) => client.player)
                        .reduce((acc, curr) => Object.assign(acc, { [curr.id]: curr.cards.map((card) => cardToObj(card)) }), {}),
        loser: loser.id,
        winner: winner.id,
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
      if (winner) {
        this.lastWinner = this.playerIDToClientMap.get(winner.id).clientData.clientID;
      } else {
        this.lastWinner = null;
      }
      this.sendToAllClients(JSON.stringify({
        // TODO: (spencer) Maybe include reason why game ended?
        type: "GAME_EVENT.GAME_OVER",
        winner: winner.id,
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
    this.stateMachine = new StateMachine(states);
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
