"use strict";
import assert from "node:assert";
import { EventEmitter } from "events";

export class StateMachine {
  /**
   * @typedef {string} State
   */
  /**
   *
   * @param {Object.<State, {transitions: State}>} states
   * @param {State} initialState
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

  verifyState(...states) {
    return states.includes(this.state);
  }
}
