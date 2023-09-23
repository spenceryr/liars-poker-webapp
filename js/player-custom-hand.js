export class PlayerCustomHandItem {
  /**
   *
   * @param {number} value
   * @param {number} count
   */
  constructor(value, count) {
    if (value > Card.MAX_VALUE) value = Card.MAX_VALUE;
    else if (value < Card.MIN_VALUE) value = Card.MIN_VALUE;
    if (count > PlayerCustomHandItem.MAX_COUNT) count = PlayerCustomHandItem.MAX_COUNT;
    else if (count <= PlayerCustomHandItem.MIN_COUNT) count = PlayerCustomHandItem.MIN_COUNT;
    this.value = value;
    this.count = count;
  }

  static get MAX_COUNT() { return 4; }
  static get MIN_COUNT() { return 1; }
}

// TODO: (spencer) Most of this probably is client side only. Just need the compare function here.
export class PlayerCustomHand {
  constructor() {
    this.items = [];
    this.count = 0;
    this.highestItemCount = 0;
    this.highestItemValue = 0;
  }

  static get COUNT_MAX() { return 5; };

  /**
   *
   * @param {PlayerCustomHandItem} item
   * @returns
   */
  addItem(item) {
    if (this.count > PlayerCustomHand.COUNT_MAX - item.count) return;
    this.items.push(item);
    this.count += item.count;
    if (item.count >= this.highestItemCount) {
      this.highestItemCount = item.count;
      if (item.value >= this.highestItemValue) {
        this.highestItemValue = item.value;
      }
    }
    let insertIndex = this.items.length;
    for (const [index, existingItem] of this.items.entries()) {
      if (item.count > existingItem.count) {
        insertIndex = index;
        break;
      } else if (item.count == existingItem.count && item.value > existingItem.value) {
        insertIndex = index;
        break;
      }
    }
    this.items.splice(insertIndex, 0, item);
  }

  removeItem(item) {
    let index = this.items.findIndex((element) => element.count == item.count && element.value == item.value);
    if (typeof index == "undefined") return;
    delete items[index];
    this.count -= item.count;
  }

  compare(against) {
    const min = Math.min(this.items.length, against.items.length);
    for (let i = 0; i < min; i++) {
      let thisItem = this.items[i];
      let againstItem = against.items[i];
      if (thisItem.count == againstItem.count) {
        if (thisItem.value == againstItem.value) {
          continue;
        }
        return thisItem.value > againstItem.value ? 1 : -1;
      }
      return thisItem.count > againstItem.count ? 1 : -1;
    }
    if (this.items.length == against.items.length) {
      return 0;
    }
    return this.items.length > against.items.length ? 1 : -1;
  }
}
