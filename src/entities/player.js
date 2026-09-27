
class Player {
  constructor() { this.hunger = 100; this.thirst = 100; this.stamina = 100; }
  update(dt) {
    // BUG: 每tick固定消耗，不按时间比例
    this.hunger -= 1;
    this.thirst -= 1;
    this.stamina -= 0.5;
  }
}

module.exports = { Player };
