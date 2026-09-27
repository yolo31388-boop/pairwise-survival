// 引擎装配入口: 把时间系统、事件调度器和各子系统接起来。
// 定时事件在 events 阶段按固定顺序触发:
//   crops(作物生长) -> monsters(怪物刷新) -> temperature(温度变化) -> player(角色状态)

const { TimeSystem } = require('./time.js');
const { EventScheduler } = require('../systems/eventScheduler.js');
const { CropSystem } = require('../systems/cropSystem.js');
const { MonsterSystem } = require('../systems/monsterSystem.js');
const { TemperatureSystem } = require('../systems/temperatureSystem.js');
const { Player } = require('../entities/player.js');

function createGame(options = {}) {
  const tickRate = options.tickRate != null ? options.tickRate : 0.1;
  const startTime = options.startTime != null ? options.startTime : 8;

  const scheduler = new EventScheduler({ tickRate, startHour: startTime });
  const time = new TimeSystem(scheduler, { tickRate, startTime });
  const crops = new CropSystem();
  const monsters = new MonsterSystem(options.monsters);
  const temperature = new TemperatureSystem({ startHour: startTime });
  const player = new Player();

  scheduler.registerSystem('crops', (ctx) => crops.update(ctx));
  scheduler.registerSystem('monsters', (ctx) => monsters.update(ctx));
  scheduler.registerSystem('temperature', (ctx) => temperature.update(ctx));
  scheduler.registerSystem('player', (ctx) => player.update(ctx.dt, ctx));

  return { time, scheduler, crops, monsters, temperature, player };
}

module.exports = { createGame };
