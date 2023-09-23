import { StateMachine } from "./state-machine";
import { LeakyBucket } from "./leaky-bucket";

/**
 * @typedef {string} ClientID
 */
export class ClientData {
  /**
   *
   * @param {ClientID} clientID
   * @param {WebSocket} ws
   */
  constructor(clientID, ws) {
    this.leakyBucket = new LeakyBucket(10, 1000);
    this.clientID = clientID;
    /** @type {WebSocket} */
    this.ws = ws;
    this.lobbyID = null;
    this.stateMachine = new ClientStateMachine();
    this.stateMachine.emitter.on("state_change", this.handleStateChange);
  }

  handleStateChange(nextState) {
    let CLIENT_STATES = ClientStateMachine.CLIENT_STATES;
    switch (nextState) {
      case CLIENT_STATES.NOT_IN_LOBBY:
        break;
      case CLIENT_STATES.IN_LOBBY:
        break;
      case CLIENT_STATES.IN_GAME:
        break;
      case CLIENT_STATES.END_GAME:
        break;
    }
  }

  get connected() {
    return this.ws.readyState == WebSocket.OPEN;
  }
}

class ClientStateMachine {
  constructor() {
    let states = {};
    for (const state in CLIENT_STATES) {
      if (!ClientStateMachine.CLIENT_STATES.hasOwnProperty(state)) return;
      states[state] = {
        transitions: ClientStateMachine.VALID_TRANSITIONS[state],
      };
    }
    this.stateMachine = new StateMachine(states);
    this.emitter = this.stateMachine.emitter;
  }

  static CLIENT_STATES = {
    DISCONNECTED: "DISCONNECTED",
    NOT_IN_LOBBY: "NOT_IN_LOBBY",
    IN_LOBBY: "IN_LOBBY",
    IN_GAME: "IN_GAME",
    END_GAME: "END_GAME",
  };

  static VALID_TRANSITIONS = (() => {
    const CLIENT_STATES = this.CLIENT_STATES;
    let t = {};
    t[CLIENT_STATES.NOT_IN_LOBBY] = [CLIENT_STATES.IN_LOBBY];
    t[CLIENT_STATES.IN_LOBBY] = [CLIENT_STATES.IN_GAME, CLIENT_STATES.NOT_IN_LOBBY];
    t[CLIENT_STATES.IN_GAME] = [CLIENT_STATES.END_GAME, CLIENT_STATES.NOT_IN_LOBBY];
    t[CLIENT_STATES.END_GAME] = [CLIENT_STATES.IN_LOBBY, CLIENT_STATES.NOT_IN_LOBBY];
    return t;
  })();
}

