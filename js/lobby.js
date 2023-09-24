import { randomUUID } from "crypto";
import { Player } from "./player";
import { ClientData } from "./client-data";
import { GAME_EVENT, Game } from "./game";
import { Card } from "./card";
/**
 * @typedef {string} ClientID
 */

/**
 * @typedef {string} PlayerID
 */

/**
 * @typedef {{ clientData: ClientData, player: Player }} Client
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
      player: new Player(playerID)
    });
    this.clientIDToPlayerIDMap.set(clientData.clientID, playerID);
    clientData.lobbyID = this.id;
    return true;
  }

  /**
   *
   * @param {ClientData} clientData
   * @returns
   */
  clientLeft(clientData) {
    // Can't leave once in game.
    if (this.game) return;
    let playerID = this.clientIDToPlayerIDMap.get(clientData.clientID);
    if (this.clientIDToPlayerIDMap.delete(clientID) || this.playerIDToClientMap.delete(playerID)) {
      clientData.lobbyID = null;
    }
  }

  createPlayerID() {
    return randomUUID();
  }

  get acceptingNewPlayers() {
    return this.playerIDToClientMap.size <= Game.PLAYERS_MAX && !this.game;
  }

  startGame() {
    if (this.game) return;
    /** @type {Player} */
    let startingPlayer = null;
    if (this.lastWinner) startingPlayer = this.playerIDToClientMap.get(this.clientIDToPlayerIDMap.get(this.lastWinner)).player;
    let players = Array.from(this.playerIDToClientMap.values()).map((client) => client.player);
    shuffleArray(players);
    if (!startingPlayer) startingPlayer = players[Math.floor(Math.random() * players.length)];
    this.game = new Game(Array.from(this.clients.values()).map((client) => client.player), startingPlayer);
    this.subscribeToGameEvents();
    if (!this.game.start()) {
      this.game = null;
    }
  }

  subscribeToGameEvents() {
    this.game.emitter.on(GAME_EVENT.SETUP, ( /** @type {Player[]} */ players) => {
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
    });
    this.game.emitter.on(GAME_EVENT.PLAYER_TURN, (player) => {
      this.sendToAllClients(JSON.stringify({
        type: "GAME_EVENT.PLAYER_TURN",
        player: player.id
      }));
    });
    this.game.emitter.on(GAME_EVENT.PLAYER_PROPOSE_HAND, ({ player, /** @type {PlayerCustomHand}*/ proposedHand }) => {
      this.sendToAllClients(JSON.stringify({
        type: "GAME_EVENT.PLAYER_PROPOSE_HAND",
        player: player.id,
        proposedHand: proposedHand.cards.map((card) => cardToObj(card)),
      }));
      this.game.playerStartTurn();
    });
    this.game.emitter.on(GAME_EVENT.REVEAL, ({ loser, winner }) => {
      this.sendToAllClients(JSON.stringify({
        type: "GAME_EVENT.REVEAL",
        playersCards: Array.from(this.playerIDToClientMap.values())
                        .map((client) => client.player)
                        .reduce((acc, curr) => Object.assign(acc, { [curr.id]: curr.cards.map((card) => cardToObj(card)) }), {}),
        loser: loser.id,
        winner: winner.id,
      }));
      this.game.startNextRoundOrEndGame();
    });
    this.game.emitter.on(GAME_EVENT.GAME_OVER, (winner) => {
      // TODO: (spencer) Verify no memory leak.
      this.game = null;
      this.lastWinner = this.playerIDToClientMap.get(winner.id).clientData.clientID;
      this.sendToAllClients(JSON.stringify({
        type: "GAME_EVENT.GAME_OVER",
        winner: winner.id,
      }));
    });
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
