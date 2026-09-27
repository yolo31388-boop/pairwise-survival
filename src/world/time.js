// 时间系统 - 时间推进必须按固定步长(tick)逐步执行，禁止直接设置目标时间
const EPSILON = 1e-9;

class TimeSystem {
  constructor() {
    this.time = 0;            // 当天时间，[0, 24) 小时
    this.day = 1;
    this.tickRate = 0.1;      // 固定步长（小时）
    this.tickCount = 0;
    this.scheduler = null;    // 可选 EventScheduler，定时事件在 tick 中触发
    this.tickListeners = [];  // 玩家输入/角色更新等，固定在每个 tick 最后处理
  }

  getCurrentTime() {
    return { day: this.day, time: this.time };
  }

  absoluteTime() {
    return (this.day - 1) * 24 + this.time;
  }

  isDay(time = this.time) {
    return time >= 6 && time < 18;
  }

  // 平滑温度模型：14 点最热、2 点最冷，昼夜切换连续无跳变
  static temperatureAt(absoluteHours) {
    return 15 + 10 * Math.cos(((absoluteHours - 14) / 24) * 2 * Math.PI);
  }

  getTemperature() {
    return TimeSystem.temperatureAt(this.absoluteTime());
  }

  onTick(listener) {
    this.tickListeners.push(listener);
  }

  // 公开用途不变：推进 hours 小时。内部必须拆成固定步长的 tick 逐步执行
  advance(hours) {
    if (!(hours >= 0)) throw new RangeError('hours must be >= 0');
    let remaining = hours;
    while (remaining > EPSILON) {
      const step = Math.min(this.tickRate, remaining);
      this.tick(step);
      remaining -= step;
    }
  }

  // 睡眠跳过夜晚：拆成多个 tick 依次执行，中间事件不丢失
  sleep(hours) {
    if (!(hours >= 0)) throw new RangeError('hours must be >= 0');
    let remaining = hours;
    while (remaining > EPSILON) {
      const step = Math.min(this.tickRate, remaining);
      this.advance(step);
      remaining -= step;
    }
  }

  // 单个 tick：固定顺序 1) 更新世界状态 2) 触发定时事件 3) 处理玩家输入/监听
  tick(dt = this.tickRate) {
    this.updateWorldState(dt);
    this.triggerScheduledEvents();
    this.processTickListeners(dt);
    this.tickCount++;
  }

  updateWorldState(dt) {
    this.time += dt;
    // 消除浮点累计误差，保证跨天与整点事件判定稳定
    this.time = Math.round(this.time / EPSILON) * EPSILON;
    while (this.time >= 24) {
      this.time -= 24;
      this.day++;
    }
  }

  triggerScheduledEvents() {
    if (this.scheduler) this.scheduler.tick(this.absoluteTime());
  }

  processTickListeners(dt) {
    for (const listener of this.tickListeners) listener(dt, this);
  }
}

module.exports = { TimeSystem };
