// 事件调度器 - 每个 tick 触发所有到期事件，只触发一次，不漏不重复
const EPSILON = 1e-9;

class EventScheduler {
  constructor() {
    this.events = [];
    this.lastTick = 0;
    this.seq = 0;
  }

  schedule(time, event) {
    this.events.push({ time, event, fired: false, seq: this.seq++ });
  }

  tick(currentTime) {
    // 触发 (lastTick, currentTime] 内所有未触发的事件，按时间先后固定顺序执行
    const due = this.events
      .filter((e) => !e.fired && e.time <= currentTime + EPSILON)
      .sort((a, b) => a.time - b.time || a.seq - b.seq);
    for (const e of due) {
      e.fired = true;
      e.event();
    }
    this.lastTick = currentTime;
  }
}

module.exports = { EventScheduler };
