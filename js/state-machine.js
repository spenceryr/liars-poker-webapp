import { assert } from "console";
import { EventEmitter } from "events";

export class StateMachine {
  /**
   * @typedef {{transitions: string}} State
   */
  /**
   *
   * @param {Object.<string, State>} states
   * @param {string} initialState
   */
  constructor(states, initialState) {
    this.states = states;
    this.state = initialState;
    this.emitter = new EventEmitter();
    assert(this.states.hasOwnProperty(initialState));
  }

  transition(nextState) {
    if (this.states[this.state].transitions.includes(nextState)) {
      this.state = nextState;
      this.emitter.emit("state_change", nextState);
    }
  }

  verifyStates(...states) {
    states.includes(this.state);
  }
}
