"use strict";
export class LeakyBucket {
  constructor(capacity, leakIntervalMS, leakAmount = 1) {
    this.capacity = capacity;
    this.amountFilled = 0;
    this.leakIntervalMS = leakIntervalMS;
    this.leakAmount = leakAmount;
    this.lastFillTime = Date.now();
  }

  fill(amount = 1) {
    let currentTime = Date.now();
    let amountLeaked = Math.floor(((currentTime - this.lastFillTime) / this.leakIntervalMS)) * this.leakAmount;
    this.amountFilled = Math.min(this.amountFilled - amountLeaked, 0);
    if (this.amountFilled + amount > this.capacity) return false;
    this.amountFilled += amount;
    return true;
  }
}
