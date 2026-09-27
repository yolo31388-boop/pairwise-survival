// 温度系统: 环境温度按一条平滑的昼夜曲线变化,
// 当前温度以固定时间常数向目标温度指数逼近。
// 指数平滑按 dt 等比例结算, 逐 tick 与跳跃结果一致,
// 昼夜切换瞬间温度也不会跳变。

class TemperatureSystem {
  constructor(options = {}) {
    this.minTemp = options.minTemp != null ? options.minTemp : 5;
    this.maxTemp = options.maxTemp != null ? options.maxTemp : 25;
    this.timeConstant = options.timeConstant != null ? options.timeConstant : 2; // 小时
    this.sunrise = options.sunrise != null ? options.sunrise : 6;
    this.sunset = options.sunset != null ? options.sunset : 18;
    this.temperature = this.targetAt(options.startHour != null ? options.startHour : 8);
    this.history = [];
  }

  // 14:00 最热, 02:00 最冷的余弦曲线
  targetAt(hour) {
    const angle = ((hour - 14) / 24) * 2 * Math.PI;
    return (this.minTemp + this.maxTemp) / 2 +
      (this.maxTemp - this.minTemp) / 2 * Math.cos(angle);
  }

  // 每 tick 定时事件
  update(ctx) {
    const target = this.targetAt(ctx.hour);
    const alpha = 1 - Math.exp(-ctx.dt / this.timeConstant);
    this.temperature += (target - this.temperature) * alpha;
    this.history.push({ hour: ctx.hour, temperature: this.temperature, target });
  }
}

module.exports = { TemperatureSystem };
