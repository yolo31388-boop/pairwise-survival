
const { TimeSystem } = require('../src/world/time.js');
const { EventScheduler } = require('../src/systems/eventScheduler.js');
const { Player } = require('../src/entities/player.js');

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
