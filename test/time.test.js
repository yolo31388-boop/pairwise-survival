const { TimeSystem } = require('../src/world/time.js');
const { EventScheduler } = require('../src/systems/eventScheduler.js');
const { Player } = require('../src/entities/player.js');
const { createGame } = require('../src/world/game.js');
const { sunlightIntensity } = require('../src/systems/environment.js');

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

  test('时间跳跃必须拆成固定步长tick, 且不跳过中间tick', () => {
    const game = createGame({ startTime: 8 });
    const ticksBefore = game.scheduler.tickCount;
    game.time.advance(8);
    const ticks = game.scheduler.tickCount - ticksBefore;
    expect(ticks).toBe(80); // 8 小时 / 0.1 小时
    expect(game.time.getCurrentTime()).toBeCloseTo(16, 10);
  });

  test('sleep 跳过夜晚时夜晚的怪物刷新与作物生长依然发生', () => {
    const game = createGame({ startTime: 22, monsters: { capacity: 20 } });
    const crop = game.crops.plant('wheat', 10);
    const lightBefore = crop.lightTime;
    const spawnedBefore = game.monsters.totalSpawned;
    game.time.sleep(10); // 22:00 -> 次日 08:00, 跨越整夜和清晨
    expect(game.time.getCurrentTime()).toBeCloseTo(8, 10);
    expect(game.monsters.totalSpawned).toBeGreaterThan(spawnedBefore);
    expect(game.monsters.monsters.length).toBe(0); // 黎明已清空
    expect(crop.lightTime).toBeGreaterThan(lightBefore); // 清晨的光照按 tick 累计了进来
  });

  test('每个tick事件触发顺序固定: 世界->作物->怪物->温度->角色->输入', () => {
    const game = createGame({ startTime: 12 });
    game.time.stepTick();
    expect(game.time.trace).toEqual([
      'world', 'crops', 'monsters', 'temperature', 'player', 'input'
    ]);
  });

  test('怪物刷新基于当前存量: 不重复刷新且达到上限后停止', () => {
    const game = createGame({ startTime: 18, monsters: { capacity: 8 } });
    game.time.advance(12); // 整夜 -> 06:00
    expect(game.monsters.totalSpawned).toBe(8); // 前 8 个夜晚 tick 各刷 1 只后达上限
    expect(game.monsters.monsters.length).toBe(0); // 黎明清空
  });

  test('怪物在新的夜晚重新刷新, 跨天不串台', () => {
    const game = createGame({ startTime: 6, monsters: { capacity: 3 } });
    game.time.advance(48); // 两夜 (到第三天 06:00)
    // 每夜各刷 3 只, 共 6 只, 不重复计入同一批
    expect(game.monsters.totalSpawned).toBe(6);
    expect(game.monsters.monsters.length).toBe(0);
  });

  test('一次性事件在同一tick内不重复触发', () => {
    const sched = new EventScheduler();
    let n = 0;
    sched.schedule(0.5, () => n++);
    sched.tick(0.5);
    sched.tick(0.5);
    sched.tick(0.6);
    expect(n).toBe(1);
  });

  test('午夜事件在睡过午夜时触发', () => {
    const game = createGame({ startTime: 23 });
    const fired = [];
    game.scheduler.schedule(0, (ctx) => fired.push(ctx.day), 'midnight');
    game.time.sleep(3); // 23:00 -> 02:00
    expect(fired).toEqual([2]);
    expect(game.time.day).toBe(2);
  });

  test('黎明事件在跨过06:00时触发', () => {
    const game = createGame({ startTime: 4 });
    let firedAt = null;
    game.scheduler.schedule(6, (ctx) => { firedAt = ctx.hour; }, 'dawn');
    game.time.advance(4); // 04:00 -> 08:00
    expect(firedAt).toBeCloseTo(6, 10);
  });

  test('作物生长基于累计光照时间而非当前是否白天', () => {
    const game = createGame({ startTime: 8 });
    const crop = game.crops.plant('wheat', 10);
    game.time.advance(10); // 08:00 -> 18:00, 整夜还没到, 全程白天
    // 满光照 tick 8.1..17.0 (9.0h) + 黄昏 17.1..17.9 衰减 (0.45h) = 9.45h
    expect(crop.lightTime).toBeCloseTo(9.45, 6);
    expect(crop.grown).toBe(false);
    game.time.sleep(12); // 18:00 -> 次日 06:00, 醒来时刻已是白天但 06:00 光照为 0
    // 跳跃结束在白天, 但光照必须是逐 tick 累计的结果, 不能因当前是白天而补发
    expect(crop.lightTime).toBeCloseTo(9.45, 6);
    game.time.advance(2); // 06:00 -> 08:00, 经过黎明过渡与 1 小时满光照 (共 1.55h) -> 成熟
    expect(crop.lightTime).toBeCloseTo(11.0, 6);
    expect(crop.grown).toBe(true);
  });

  test('作物累计光照与逐tick积分一致 (黎明/黄昏平滑过渡)', () => {
    const game = createGame({ startTime: 4 });
    const crop = game.crops.plant('berry', 100);
    game.time.advance(5); // 04:00 -> 09:00, 经过黎明
    let expected = 0;
    for (let i = 1; i <= 50; i++) {
      expected += sunlightIntensity(Math.round((4 + i * 0.1) * 10) / 10) * 0.1;
    }
    expect(crop.lightTime).toBeCloseTo(expected, 5);
    expect(crop.lightTime).toBeGreaterThan(0);
  });

  test('温度平滑过渡: 昼夜切换与长跳跃均无跳变', () => {
    const game = createGame({ startTime: 5.9 });
    const before = game.temperature.temperature;
    game.time.stepTick(); // 跨过 06:00 黎明边界
    expect(Math.abs(game.temperature.temperature - before)).toBeLessThan(0.5);

    const g2 = createGame({ startTime: 0 });
    let maxDelta = 0;
    g2.time.advance(24);
    const hist = g2.temperature.history;
    for (let i = 1; i < hist.length; i++) {
      maxDelta = Math.max(maxDelta, Math.abs(hist[i].temperature - hist[i - 1].temperature));
    }
    expect(maxDelta).toBeLessThan(0.5); // 每个 tick 平滑, 无任何跳变
  });

  test('角色饥饿/口渴/体力每tick按比例消耗', () => {
    const p = new Player();
    p.update(2);
    expect(p.hunger).toBeCloseTo(96, 6);
    expect(p.thirst).toBeCloseTo(95, 6);
    expect(p.stamina).toBeCloseTo(90, 6);
  });

  test('时间跳跃时角色状态按比例累计, 睡眠恢复体力', () => {
    const awake = createGame({ startTime: 8 });
    awake.time.advance(4);
    expect(awake.player.hunger).toBeCloseTo(92, 6);
    expect(awake.player.thirst).toBeCloseTo(90, 6);
    expect(awake.player.stamina).toBeCloseTo(80, 6);

    const sleeping = createGame({ startTime: 22 });
    sleeping.time.sleep(8);
    expect(sleeping.player.hunger).toBeCloseTo(84, 6);
    expect(sleeping.player.thirst).toBeCloseTo(80, 6);
    expect(sleeping.player.stamina).toBeCloseTo(100, 6); // 8h * 30/h 恢复并封顶
  });

  test('长跳跃后各系统状态与逐tick推进完全一致', () => {
    const stepGame = createGame({ startTime: 8 });
    const jumpGame = createGame({ startTime: 8 });
    stepGame.crops.plant('wheat', 10);
    jumpGame.crops.plant('wheat', 10);

    for (let i = 0; i < 300; i++) stepGame.time.stepTick(); // 30 小时逐 tick
    jumpGame.time.advance(30);

    expect(jumpGame.time.getCurrentTime()).toBeCloseTo(stepGame.time.getCurrentTime(), 10);
    expect(jumpGame.time.day).toBe(stepGame.time.day);
    expect(jumpGame.crops.crops[0].lightTime).toBeCloseTo(stepGame.crops.crops[0].lightTime, 8);
    expect(jumpGame.crops.crops[0].growth).toBeCloseTo(stepGame.crops.crops[0].growth, 8);
    expect(jumpGame.monsters.totalSpawned).toBe(stepGame.monsters.totalSpawned);
    expect(jumpGame.monsters.monsters.length).toBe(stepGame.monsters.monsters.length);
    expect(jumpGame.temperature.temperature).toBeCloseTo(stepGame.temperature.temperature, 8);
    expect(jumpGame.player.hunger).toBeCloseTo(stepGame.player.hunger, 8);
    expect(jumpGame.player.thirst).toBeCloseTo(stepGame.player.thirst, 8);
    expect(jumpGame.player.stamina).toBeCloseTo(stepGame.player.stamina, 8);
  });

  test('长时间跳跃的性能: 10万tick毫秒级完成', () => {
    const game = createGame({ startTime: 0 });
    game.crops.plant('wheat', 10);
    const start = Date.now();
    game.time.advance(10000); // 100000 个 tick
    const elapsed = Date.now() - start;
    expect(game.scheduler.tickCount).toBe(100000);
    expect(elapsed).toBeLessThan(1000);
  });

  test('跨多天后日期与时刻正确', () => {
    const game = createGame({ startTime: 8 });
    game.time.advance(73); // 3 天零 1 小时
    expect(game.time.day).toBe(4);
    expect(game.time.getCurrentTime()).toBeCloseTo(9, 10);
  });

  test('睡眠期间不处理玩家输入, 醒后恢复', () => {
    const game = createGame({ startTime: 22 });
    let inputs = 0;
    game.time.onInput(() => { inputs++; });
    game.time.sleep(8);
    expect(inputs).toBe(0);
    game.time.advance(1);
    expect(inputs).toBe(10);
  });
});
