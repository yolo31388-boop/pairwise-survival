// 玩家状态。每个 tick 按经过时间 dt(小时) 等比例消耗/恢复,
// 因此逐 tick 推进与一次性跳跃的最终状态完全一致。

class Player {
  constructor() {
    this.hunger = 100;
    this.thirst = 100;
    this.stamina = 100;
  }

  // 每小时消耗速率
  static get RATES() {
    return { hunger: 2, thirst: 2.5, stamina: 5, staminaSleepRecovery: 30 };
  }

  update(dt, ctx) {
    if (dt == null) dt = 0.1;
    if (typeof dt === 'object') { ctx = dt; dt = ctx.dt; }
    const rates = Player.RATES;
    this.hunger = clamp(this.hunger - rates.hunger * dt);
    this.thirst = clamp(this.thirst - rates.thirst * dt);
    if (ctx && ctx.sleeping) {
      // 睡眠时恢复体力, 同样按时间比例累计
      this.stamina = clamp(this.stamina + rates.staminaSleepRecovery * dt);
    } else {
      this.stamina = clamp(this.stamina - rates.stamina * dt);
    }
  }
}

function clamp(v) {
  return Math.max(0, Math.min(100, v));
}

module.exports = { Player };
