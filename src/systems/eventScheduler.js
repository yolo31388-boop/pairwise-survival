
class EventScheduler {
  constructor() { this.events = []; this.lastTick = 0; }
  schedule(time, event) { this.events.push({time, event}); }
  tick(currentTime) {
    // BUG: 只处理当前时间点的事件，不补中间的
    for (const e of this.events) {
      if (Math.abs(e.time - currentTime) < 0.01) e.event();
    }
  }
}

module.exports = { EventScheduler };
