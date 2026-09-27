
// 时间系统 - 存在跳跃跳过tick的bug
class TimeSystem {
  constructor() { this.time = 0; this.day = 1; this.tickRate = 0.1; }
  advance(hours) {
    // BUG: 直接设置时间，不拆分成tick
    this.time += hours;
    if (this.time >= 24) { this.time -= 24; this.day++; }
  }
  sleep(hours) {
    // BUG: 睡觉直接跳时间，事件不触发
    this.advance(hours);
  }
}

module.exports = { TimeSystem };
