// 事件调度器
//
// 职责:
//   - registerSystem(name, handler): 注册每 tick 定时事件
//     (作物生长、怪物刷新、温度变化、角色状态更新)。
//     触发顺序固定: crops -> monsters -> temperature -> player。
//   - schedule(timeOfDay, event, label): 注册一天内某时刻触发的一次性
//     事件 (如午夜 0:00、黎明 6:00)。
//
// 不变量:
//   - 时间只能被 tick 驱动。tick 以“当前绝对 tick 号”为水位线,
//     期间所有到期的定时事件都会在这次 tick 内依次触发, 不重不漏:
//     时间跳跃拆成的每个中间 tick 都会各自结算一次。
//   - tick 的阶段顺序由 TimeSystem 保证 (world -> events -> input),
//     本调度器负责 events 阶段内的固定顺序。

const SYSTEM_ORDER = ['crops', 'monsters', 'temperature', 'player'];

class EventScheduler {
  constructor(options = {}) {
    this.systems = [];
    this.events = []; // 一次性事件, 按触发的绝对 tick 号升序
    this.lastTick = 0; // 已结算到的绝对 tick 号 (水位线)
    this.tickCount = 0; // 已执行的 tick 数
    this.tickRate = options.tickRate != null ? options.tickRate : 0.1;
    this.startHour = options.startHour != null ? options.startHour : 0;
    this.lastTick = Math.round(this.startHour / this.tickRate);
  }

  registerSystem(name, handler) {
    this.systems.push({ name, handler });
    this.systems.sort((a, b) => {
      const ia = SYSTEM_ORDER.indexOf(a.name);
      const ib = SYSTEM_ORDER.indexOf(b.name);
      return (ia === -1 ? SYSTEM_ORDER.length : ia) - (ib === -1 ? SYSTEM_ORDER.length : ib);
    });
  }

  // 在当天 timeOfDay(小时) 触发的一次性事件。
  schedule(timeOfDay, event, label) {
    const delta = ((timeOfDay - this.startHour) % 24 + 24) % 24;
    const atTick = this.lastTick + Math.round(delta / this.tickRate);
    this.events.push({ atTick, event, label: label || 'event' });
    this.events.sort((a, b) => a.atTick - b.atTick);
  }

  // 逐 tick 结算。支持两种入参:
  //   tick(ctx)        引擎调用, ctx 由 TimeSystem 提供
  //   tick(currentTime) 兼容直接用当天小时驱动的调用方式
  tick(input) {
    let ctx;
    if (typeof input === 'number') {
      const elapsed = (((input - this.startHour) % 24) + 24) % 24;
      const totalTicks = Math.round((this.startHour + elapsed) / this.tickRate);
      ctx = {
        dt: this.tickRate,
        tick: totalTicks,
        hour: input,
        day: Math.floor((this.startHour + elapsed) / 24) + 1
      };
    } else {
      ctx = input;
    }

    if (ctx.tick <= this.lastTick) return;

    // 每 tick 依次触发所有定时系统, 顺序固定
    for (const system of this.systems) {
      system.handler(ctx);
      if (ctx.trace) ctx.trace.push(system.name);
    }

    // 一次性事件: 触发 (lastTick, ctx.tick] 区间内到期的所有事件
    const due = this.events.filter((e) => e.atTick > this.lastTick && e.atTick <= ctx.tick);
    due.sort((a, b) => a.atTick - b.atTick);
    for (const e of due) {
      e.event(ctx);
      if (ctx.trace) ctx.trace.push('scheduled:' + e.label);
    }
    this.events = this.events.filter((e) => e.atTick > ctx.tick);

    this.lastTick = ctx.tick;
    this.tickCount++;
  }
}

module.exports = { EventScheduler, SYSTEM_ORDER };
