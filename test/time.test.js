const { TimeSystem } = require('../src/world/time.js');
const { EventScheduler } = require('../src/systems/eventScheduler.js');
const { Player } = require('../src/entities/player.js');
const { MonsterSpawner } = require('../src/systems/monsterSpawner.js');
const { Crop } = require('../src/systems/crop.js');

describe('生存昼夜循环', () => {
  test('时间跳跃应拆分成tick', () => {
    const ts = new TimeSystem();
    let tickCount = 0;
    const orig = ts.advance.bind(ts);
    ts.advance = (h) => { tickCount++; orig(h); };
    ts.sleep(8);
    expect(tickCount).toBeGreaterThan(1);
  });

  test('每tick事件应依次触发', () => {
    const sched = new EventScheduler();
    const fired = [];
    sched.schedule(0.1, () => fired.push('a'));
    sched.schedule(0.2, () => fired.push('b'));
    sched.tick(0.1);
    sched.tick(0.2);
    expect(fired).toEqual(['a', 'b']);
  });

  test('怪物刷新不重复不遗漏', () => {
    const sched = new EventScheduler();
    let count = 0;
    sched.schedule(0.1, () => count++);
    sched.schedule(0.1, () => count++);
    sched.tick(0.1);
    expect(count).toBe(2);
  });

  test('角色状态应按比例消耗', () => {
    const p = new Player();
    p.update(0.5);
    expect(p.hunger).toBeLessThan(100);
    expect(p.hunger).toBeGreaterThan(90);
  });

  test('跨天日期正确', () => {
    const ts = new TimeSystem();
    ts.advance(24);
    expect(ts.day).toBe(2);
    expect(ts.time).toBeCloseTo(0, 1);
  });

  test('跳跃后状态与逐tick一致', () => {
    const p1 = new Player();
    const p2 = new Player();
    for (let i = 0; i < 10; i++) p1.update(0.1);
    p2.update(1.0);
    expect(Math.abs(p1.hunger - p2.hunger)).toBeLessThan(1);
  });
});

describe('引擎边界不变量', () => {
  test('时间跳跃拆分成固定步长的tick', () => {
    const ts = new TimeSystem();
    const steps = [];
    ts.onTick((dt) => steps.push(dt));
    ts.advance(5);
    expect(steps.length).toBe(50);
    for (const dt of steps) expect(dt).toBeCloseTo(0.1, 9);
    expect(ts.time).toBeCloseTo(5, 9);
    expect(ts.day).toBe(1);
  });

  test('sleep跳跃中每个tick的事件依次触发不丢失', () => {
    const ts = new TimeSystem();
    const sched = new EventScheduler();
    ts.scheduler = sched;
    const fired = [];
    sched.schedule(1.0, () => fired.push(1));
    sched.schedule(2.5, () => fired.push(2.5));
    sched.schedule(3.9, () => fired.push(3.9));
    ts.sleep(4);
    expect(fired).toEqual([1, 2.5, 3.9]);
  });

  test('怪物刷新基于当前时间和现存数量，不重复不遗漏', () => {
    const ts = new TimeSystem();
    const spawner = new MonsterSpawner(5);
    ts.onTick(() => spawner.update(ts.time));
    ts.advance(12);          // 0:00 -> 12:00（0-4 点为夜晚，已刷满）
    expect(spawner.monsters.length).toBe(5);
    spawner.clear();
    ts.advance(7);           // 12:00 -> 19:00，白天不刷新
    expect(spawner.monsters.length).toBe(0);
    ts.advance(9);           // 19:00 -> 次日 4:00，夜间刷满上限
    expect(spawner.monsters.length).toBe(5);       // 刷满上限
    ts.advance(24);          // 再过一个完整昼夜
    expect(spawner.monsters.length).toBe(5);       // 不重复刷新
    spawner.clear();
    ts.advance(20);          // 再次进入夜晚
    expect(spawner.monsters.length).toBe(5);       // 不漏刷
  });

  test('作物生长基于累计光照时间而非当前是否白天', () => {
    const ts = new TimeSystem();
    const crop = new Crop(1);
    ts.onTick((dt) => crop.update(dt, ts.isDay()));
    ts.advance(18);          // 0:00 -> 18:00，其中 6:00-18:00 有光照
    expect(crop.lightHours).toBeCloseTo(12, 9);
    expect(crop.growth).toBeCloseTo(12, 9);
    ts.advance(11);          // 18:00 -> 次日 5:00，整夜无光照
    expect(crop.lightHours).toBeCloseTo(12, 9);
    expect(crop.growth).toBeCloseTo(12, 9);
    ts.advance(6.9);         // 5:00 -> 11:54，累计光照继续增加
    expect(crop.growth).toBeCloseTo(18, 9);
  });

  test('温度平滑过渡，昼夜切换不跳变', () => {
    const ts = new TimeSystem();
    let prev = ts.getTemperature();
    let maxDelta = 0;
    ts.onTick(() => {
      const cur = ts.getTemperature();
      maxDelta = Math.max(maxDelta, Math.abs(cur - prev));
      prev = cur;
    });
    ts.advance(48);          // 跨两个完整昼夜，含午夜与黎明
    expect(maxDelta).toBeLessThan(0.3);
    expect(Math.abs(TimeSystem.temperatureAt(24) - TimeSystem.temperatureAt(0))).toBeLessThan(1e-9);
  });

  test('角色饥饿口渴体力每tick按比例消耗', () => {
    const p = new Player();
    p.update(2);
    expect(p.hunger).toBeCloseTo(98, 9);
    expect(p.thirst).toBeCloseTo(97, 9);
    expect(p.stamina).toBeCloseTo(99, 9);
    const q = new Player();
    q.update(1);
    q.update(1);
    expect(q.hunger).toBeCloseTo(p.hunger, 9);
    expect(q.thirst).toBeCloseTo(p.thirst, 9);
    expect(q.stamina).toBeCloseTo(p.stamina, 9);
  });

  test('事件触发顺序固定：世界状态 -> 定时事件 -> 玩家输入', () => {
    const ts = new TimeSystem();
    const sched = new EventScheduler();
    ts.scheduler = sched;
    const order = [];
    sched.schedule(0.1, () => order.push(`event@${ts.getCurrentTime().time}`));
    ts.onTick(() => order.push(`player@${ts.getCurrentTime().time}`));
    ts.advance(0.1);
    // 事件与玩家处理时世界时间已推进到 0.1，且事件先于玩家
    expect(order).toEqual(['event@0.1', 'player@0.1']);
  });

  test('长时间跳跃性能与正确性', () => {
    const ts = new TimeSystem();
    const start = Date.now();
    ts.advance(24 * 30);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000);
    expect(ts.day).toBe(31);
    expect(ts.time).toBeCloseTo(0, 9);
    expect(ts.tickCount).toBe(7200);
  });

  test('跨天与多日日期正确', () => {
    const ts = new TimeSystem();
    ts.advance(25.5);
    expect(ts.day).toBe(2);
    expect(ts.time).toBeCloseTo(1.5, 9);
    ts.advance(48);
    expect(ts.day).toBe(4);
    expect(ts.time).toBeCloseTo(1.5, 9);
    expect(ts.getCurrentTime()).toEqual({ day: 4, time: 1.5 });
  });

  test('午夜事件在跨天tick触发且只触发一次', () => {
    const ts = new TimeSystem();
    const sched = new EventScheduler();
    ts.scheduler = sched;
    const firedAt = [];
    sched.schedule(24.0, () => firedAt.push(ts.absoluteTime()));
    ts.advance(24);
    expect(firedAt.length).toBe(1);
    expect(firedAt[0]).toBeCloseTo(24, 9);
    expect(ts.day).toBe(2);
    ts.advance(24);          // 再过一天不重复触发
    expect(firedAt.length).toBe(1);
  });

  test('黎明事件在6点整触发', () => {
    const ts = new TimeSystem();
    const sched = new EventScheduler();
    ts.scheduler = sched;
    const fired = [];
    sched.schedule(6.0, () => fired.push(ts.time));
    ts.advance(5.9);
    expect(fired.length).toBe(0);
    ts.advance(0.2);
    expect(fired.length).toBe(1);
    expect(fired[0]).toBeCloseTo(6, 9);
  });

  test('时间跳跃后全系统状态与逐tick推进一致', () => {
    const buildWorld = () => {
      const ts = new TimeSystem();
      const sched = new EventScheduler();
      ts.scheduler = sched;
      const player = new Player();
      const crop = new Crop(1);
      const spawner = new MonsterSpawner(5);
      let eventsFired = 0;
      for (let h = 0.1; h <= 12; h += 0.7) sched.schedule(h, () => eventsFired++);
      ts.onTick((dt) => {
        player.update(dt);
        crop.update(dt, ts.isDay());
        spawner.update(ts.time);
      });
      return { ts, player, crop, spawner, fired: () => eventsFired };
    };
    const a = buildWorld();
    a.ts.advance(12);                    // 一次性跳跃 12 小时
    const b = buildWorld();
    for (let i = 0; i < 120; i++) b.ts.advance(0.1);  // 逐 tick 推进
    expect(a.ts.day).toBe(b.ts.day);
    expect(a.ts.time).toBeCloseTo(b.ts.time, 9);
    expect(a.ts.tickCount).toBe(b.ts.tickCount);
    expect(a.player.hunger).toBeCloseTo(b.player.hunger, 9);
    expect(a.player.thirst).toBeCloseTo(b.player.thirst, 9);
    expect(a.player.stamina).toBeCloseTo(b.player.stamina, 9);
    expect(a.crop.growth).toBeCloseTo(b.crop.growth, 9);
    expect(a.crop.lightHours).toBeCloseTo(b.crop.lightHours, 9);
    expect(a.spawner.monsters.length).toBe(b.spawner.monsters.length);
    expect(a.fired()).toBe(b.fired());
  });
});
