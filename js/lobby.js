import { randomUUID } from "crypto";
import { Player } from "./player";
import { ClientData } from "./client-data";
import { Game } from "./game";
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
    /** @type {Player} */
    let startingPlayer = null;
    if (this.lastWinner) startingPlayer = this.playerIDToClientMap.get(this.clientIDToPlayerIDMap.get(this.lastWinner)).player;
    let players = Array.from(this.playerIDToClientMap.values()).map((client) => client.player);
    shuffleArray(players);
    if (!startingPlayer) startingPlayer = players[Math.floor(Math.random() * players.length)];
    this.game = new Game(Array.from(this.clients.values()).map((client) => client.player), startingPlayer);
  }
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
  }
}
