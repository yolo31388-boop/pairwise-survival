// 怪物刷新系统。
//
// 规则:
//   - 夜晚 (18:00~次日6:00) 才会刷新, 黎明清空前一夜的怪物。
//   - 刷新基于“当前时间 + 当前已存在的怪物数量”: 场上数量达到上限
//     (capacity) 不再刷; 每个 tick 最多刷 perTick 只。
//   - 因为每个 tick 都按当前存量重新判断, 时间跳跃拆出的中间 tick
//     逐 tick 结算时既不会漏刷 (夜里每个 tick 都有机会) 也不会重复刷
//     (满了就停, 黎明清空只在昼夜翻转的那个 tick 发生一次)。

class MonsterSystem {
  constructor(options = {}) {
    this.monsters = [];
    this.capacity = options.capacity != null ? options.capacity : 8;
    this.perTick = options.perTick != null ? options.perTick : 1;
    this.nightStart = options.nightStart != null ? options.nightStart : 18;
    this.dayStart = options.dayStart != null ? options.dayStart : 6;
    this.totalSpawned = 0; // 统计: 累计刷新次数, 便于测试观察
    this.census = [];      // 每次刷新/清空后的 (tick, hour, count) 记录
  }

  _isNight(hour) {
    return hour >= this.nightStart || hour < this.dayStart;
  }

  // 每 tick 定时事件
  update(ctx) {
    const before = this.monsters.length;
    const wasNight = this._isNight(this._previousHour(ctx));
    const isNight = this._isNight(ctx.hour);

    // 昼夜翻转: 只在 夜->昼 的那个 tick 清空一次
    if (wasNight && !isNight && this.monsters.length > 0) {
      this.monsters.length = 0;
    }

    if (isNight) {
      let spawned = 0;
      while (spawned < this.perTick && this.monsters.length < this.capacity) {
        this.monsters.push({ id: ++this.totalSpawned, spawnTick: ctx.tick });
        spawned++;
      }
    }

    if (this.monsters.length !== before) {
      this.census.push({ tick: ctx.tick, hour: ctx.hour, count: this.monsters.length });
    }
  }

  _previousHour(ctx) {
    const h = ctx.hour - ctx.dt;
    return h < 0 ? h + 24 : h;
  }
}

module.exports = { MonsterSystem };
