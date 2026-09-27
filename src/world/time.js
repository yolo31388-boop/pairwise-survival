// 时间系统
//
// 不变量:
//   1. 时间推进只能按固定步长 (tickRate 小时) 逐 tick 执行,
//      不允许直接把 time 设置成某个目标值。
//   2. 每个 tick 的阶段顺序固定:
//        world   - 更新世界状态 (日期推进、光照)
//        events  - 触发定时事件 (作物生长、怪物刷新、温度、角色状态)
//        input   - 处理玩家输入
//   3. advance()/sleep() 的时间跳跃必须拆成多个 tick 依次执行,
//      中间任何一个 tick 都不能跳过。

const { isDaytime, sunlightIntensity } = require('../systems/environment.js');

class TimeSystem {
  constructor(scheduler, options = {}) {
    this.tickRate = options.tickRate != null ? options.tickRate : 0.1; // 小时/tick
    this.time = 0;        // 当天经过的小时, [0, 24)
    this.day = 1;         // 第几天
    this.totalTicks = 0;  // 世界从开始经过的 tick 总数
    this.isSleeping = false;
    this.dayStart = options.sunrise != null ? options.sunrise : 6;
    this.nightStart = options.sunset != null ? options.sunset : 18;
    this.scheduler = scheduler || null;
    this.inputHandlers = [];
    this.trace = null; // 非 null 时记录最近一个 tick 的执行轨迹

    const start = options.startTime != null ? options.startTime : 0;
    this.totalTicks = Math.round(start / this.tickRate);
    this.time = this._hourAt(this.totalTicks);
    this.day = Math.floor(this.totalTicks * this.tickRate / 24) + 1;
  }

  // 公开 API: 获取当前时间 (当天小时数, 浮点)
  getCurrentTime() {
    return this.time;
  }

  getSunlight() {
    return sunlightIntensity(this.time, this.dayStart, this.nightStart);
  }

  isDay() {
    return isDaytime(this.time, this.dayStart, this.nightStart);
  }

  onInput(handler) {
    this.inputHandlers.push(handler);
  }

  // 公开 API: 向后推进 hours 小时。跳跃被拆成若干 tick。
  advance(hours) {
    const wholeTicks = Math.round(hours / this.tickRate);
    for (let i = 0; i < wholeTicks; i++) this.stepTick();
  }

  // 公开 API: 睡觉跳过若干小时 —— 仍然逐 tick 推进, 事件一个不漏。
  // 走 advance 拆 tick, 保证与普通时间推进完全相同的结算路径。
  sleep(hours) {
    const wholeTicks = Math.round(hours / this.tickRate);
    this.isSleeping = true;
    try {
      for (let i = 0; i < wholeTicks; i++) this.advance(this.tickRate);
    } finally {
      this.isSleeping = false;
    }
  }

  // 单个固定步长: 世界状态 -> 定时事件 -> 玩家输入
  stepTick() {
    const trace = [];
    this.trace = trace;

    // 阶段 1: 更新世界状态
    this.totalTicks++;
    const absoluteHours = this.totalTicks * this.tickRate;
    this.time = this._hourAt(this.totalTicks);
    this.day = Math.floor(absoluteHours / 24) + 1;
    const ctx = {
      dt: this.tickRate,
      tick: this.totalTicks,
      hour: this.time,
      day: this.day,
      sleeping: this.isSleeping,
      sunlight: this.getSunlight(),
      isDay: this.isDay(),
      timeSystem: this,
      trace
    };
    trace.push('world');

    // 阶段 2: 触发定时事件
    if (this.scheduler) this.scheduler.tick(ctx);

    // 阶段 3: 处理玩家输入 (睡眠时玩家处于不可操作状态)
    if (!this.isSleeping) {
      for (const handler of this.inputHandlers) handler(ctx);
    }
    trace.push('input');
  }

  _hourAt(totalTicks) {
    return Math.round((totalTicks * this.tickRate) % 24 * 1e6) / 1e6;
  }
}

module.exports = { TimeSystem };
