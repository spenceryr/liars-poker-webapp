"use strict";
import { assert } from "console";
import { EventEmitter } from "events";

export class StateMachine {
  /**
   * @typedef {} State
   */
  /**
   *
   * @param {Object.<string, {transitions: string}>} states
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
      return true;
    }
    return false;
  }

  verifyStates(...states) {
    states.includes(this.state);
  }
}
