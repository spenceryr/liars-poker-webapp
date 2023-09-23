import { StateMachine } from "./state-machine";
import { LeakyBucket } from "./leaky-bucket";

/**
 * @typedef {number} ClientID
 */
export class ClientData {
  constructor(clientID) {
    this.leakyBucket = new LeakyBucket(10, 1000);
    this.clientID = clientID;
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
    NOT_IN_LOBBY: "0",
    IN_LOBBY: "1",
    IN_GAME: "2",
    END_GAME: "3",
  };

  static VALID_TRANSITIONS = (() => {
    let t = {};
    t[this.CLIENT_STATES.NOT_IN_LOBBY] = [this.CLIENT_STATES.IN_LOBBY];
    t[this.CLIENT_STATES.IN_LOBBY] = [this.CLIENT_STATES.IN_GAME, this.CLIENT_STATES.NOT_IN_LOBBY];
    t[this.CLIENT_STATES.IN_GAME] = [this.CLIENT_STATES.END_GAME, this.CLIENT_STATES.NOT_IN_LOBBY];
    t[this.CLIENT_STATES.END_GAME] = [this.CLIENT_STATES.IN_GAME, this.CLIENT_STATES.IN_LOBBY, this.CLIENT_STATES.NOT_IN_LOBBY];
    return t;
  })();
}

