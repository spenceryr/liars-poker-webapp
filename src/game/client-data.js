"use strict";
import { WebSocket } from "ws";
import { LeakyBucket } from "./leaky-bucket.js";
import { LobbyStore } from "./lobby.js";
import { Card } from "./card.js";
import assert from "node:assert";

/**
 * @typedef {string} ClientID
 */

/**
 *
 * @typedef {import("./lobby").LobbyID} LobbyID
 */

export class ClientData {
  /**
   *
   * @param {ClientID} clientID
   */
  constructor(clientID) {
    this.leakyBucket = new LeakyBucket(10, 1000);
    this.clientID = clientID;
    /** @type {WebSocket?} */
    this.ws = null;
    /** @type {LobbyID?} */
    this.lobbyID = null;
    /** @type {import("./player").Player} */
    this.player = null;
  }

  get lobby() {
    if (!this.lobbyID) return undefined;
    return LobbyStore.get(this.lobbyID);
  }

  /**
   *
   * @param {string} data
   * @returns
   */
  sendMessage(data) {
    if (!this.isConnected) return;
    console.debug(`Sending message to ${this.clientID}: ${data}`);
    this.ws?.send(data);
  }

  /**
   *
   * @param {WebSocket} ws
   * @returns {boolean}
   */
  connectedToWS(ws) {
    if (ws.readyState !== ws.OPEN) {
      console.debug(`Client ${this.clientID} connected but socket is not open!`);
      return false;
    }
    this.ws = ws;
    ws.on("close", this.onClose.bind(this));
    ws.on("message", this.onMessage.bind(this));
    let lobby = this.lobby;
    if (!lobby) {
      console.debug(`Client ${this.clientID} connected without lobby!`);
      return false;
    }
    let gameSnapshot = (this.lobby.inGame && this.lobby.game?.getGameSnapshot()) || null;
    // Add 'playerHand' prop to gameSnapshot to provide this player's hand.
    if (gameSnapshot) {
      gameSnapshot['playerHand'] = this.player.cards.map((card) => card.toObj());
    }
    console.debug(`Client ${this.clientID} connected`);
    this.sendMessage(JSON.stringify({
      type: "CLIENT_EVENT",
      event: "CONNECTION_ACK",
      snapshot: {
        playerID: this.player.playerID,
        lobby: lobby.getLobbySnapshot(),
        game: gameSnapshot
      }
    }));
    assert(lobby.clientConnected(this));
    return true;
  }

  /**
   *
   * @param {LobbyID} lobbyID
   */
  joinLobby(lobbyID) {
    console.debug(`Client ${this.clientID} join lobby ${lobbyID}`);
    if (this.lobbyID === lobbyID) {
      console.debug(`Client ${this.clientID} already in lobby ${lobbyID}!`);
      return true;
    }
    // Leave current lobby.
    this.leaveLobby();
    let lobby = LobbyStore.get(lobbyID);
    if (!lobby) {
      console.debug(`Client ${this.clientID} could not find lobby ${lobbyID}!`);
      return false;
    }
    return lobby.clientJoined(this);
  }

  leaveLobby() {
    console.debug(`Client ${this.clientID} leave lobby ${this.lobbyID}`);
    this.lobby?.clientLeft(this);
  }

  onClose() {
    console.debug(`Client ${this.clientID} disconnect`);
    this.lobby?.clientDisconnect(this);
  }

  /**
   *
   * @param {MessageEvent} ev
   * @returns
   */
  onMessage(ev) {
    if (!this.leakyBucket.fill()) return;
    let msg = null;
    try {
      msg = JSON.parse(ev);
    } catch (e) {
      console.error(`Error processing JSON ${ev} from client ${this.clientID}: ${e}`);
      return;
    }
    console.debug(`Client ${this.clientID} received msg ${JSON.stringify(msg)}`);
    this.processMsg(msg);
  }

  processMsg(msg) {
    let type = msg.type;
    if (typeof type !== "string") return;
    let CLIENT_MSGS = ClientData.CLIENT_MSGS;
    switch (type) {
      case CLIENT_MSGS.READY_UP: {
        let lobby = this.lobby;
        if (!lobby) return;
        lobby.clientReady(this);
        break;
      }
      case CLIENT_MSGS.READY_DOWN: {
        let lobby = this.lobby;
        if (!lobby) return;
        lobby.clientUnReady(this);
        break;
      }
      case CLIENT_MSGS.RETURN_TO_PRE_GAME_LOBBY: {
        let lobby = this.lobby;
        if (!lobby) return;
        // TODO: (spencer) Maybe only allow while in post game?
        lobby.returnToPreGameLobby();
        break;
      }
      case CLIENT_MSGS.CALL_PLAYER: {
        let lobby = this.lobby;
        if (!lobby) return;
        let game = lobby.game;
        if (!game) return;
        if (!this.player) return;
        if (!msg.playerID || typeof msg.playerID !== "string") return;
        game.playerCalled(this.player, msg.playerID);
        break;
      }
      case CLIENT_MSGS.PROPOSED_HAND: {
        let lobby = this.lobby;
        if (!lobby) return;
        let game = lobby.game;
        if (!game) return;
        if (!this.player) return;
        if (!msg.proposedHand || !Array.isArray(msg.proposedHand)) return;
        let cards = [];
        for (const card of msg.proposedHand) {
          if (!card.value || typeof card.value !== "number") return;
          cards.push(new Card(card.value));
        }
        game.playerProposedHand(this.player, cards);
        break;
      }
    }
  }
  static CLIENT_MSGS = {
    PROPOSED_HAND: "PROPOSED_HAND",
    CALL_PLAYER: "CALL_PLAYER",
    READY_UP: "READY_UP",
    READY_DOWN: "READY_DOWN",
    RETURN_TO_PRE_GAME_LOBBY: "RETURN_TO_PRE_GAME_LOBBY",
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get isDisconnected() {
    return !this.ws || this.ws.readyState === WebSocket.CLOSED;
  }

  get isDisconnecting() {
    return this.ws?.readyState === WebSocket.CLOSING;
  }
}

export const ClientDataStore = {
  /** @type {Map<ClientID, ClientData>} */
  clientMapping: new Map(),

  /**
   *
   * @param {ClientID} clientID
   * @param {ClientData} clientData
   */
  set(clientID, clientData) {
    this.clientMapping.set(clientID, clientData)
  },

  /**
   *
   * @param {ClientID} clientID
   * @returns {boolean}
   */
  delete(clientID) {
    return this.clientMapping.delete(clientID);
  },

  /**
   *
   * @param {ClientID} clientID
   * @returns {ClientData | undefined}
   */
  get(clientID) {
    return this.clientMapping.get(clientID);
  }
}

