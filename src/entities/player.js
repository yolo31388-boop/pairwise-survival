// 角色状态 - 饥饿/口渴/体力按时间比例消耗，时间跳跃时按累计时长结算
class Player {
  constructor() {
    this.hunger = 100;
    this.thirst = 100;
    this.stamina = 100;
    this.hungerRate = 1;    // 每小时消耗
    this.thirstRate = 1.5;
    this.staminaRate = 0.5;
  }

  update(dt) {
    this.hunger = Math.max(0, this.hunger - this.hungerRate * dt);
    this.thirst = Math.max(0, this.thirst - this.thirstRate * dt);
    this.stamina = Math.max(0, this.stamina - this.staminaRate * dt);
  }
}

module.exports = { Player };
