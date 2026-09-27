// 作物系统: 生长基于累计光照时间, 而不是“当前是不是白天”。
// 每个 tick 把 光照强度 * dt 累加进作物的光照时长;
// 逐 tick 推进与时间跳跃的累计结果一致。

class CropSystem {
  constructor() {
    this.crops = [];
  }

  plant(name, requiredLightHours = 10) {
    const crop = {
      name,
      lightTime: 0, // 累计获得的光照小时数
      growth: 0,    // 0~1
      grown: false,
      requiredLightHours
    };
    this.crops.push(crop);
    return crop;
  }

  // 每 tick 定时事件
  update(ctx) {
    const light = ctx.sunlight != null ? ctx.sunlight : 0;
    for (const crop of this.crops) {
      crop.lightTime += light * ctx.dt;
      crop.growth = Math.min(1, crop.lightTime / crop.requiredLightHours);
      crop.grown = crop.lightTime >= crop.requiredLightHours;
    }
  }
}

module.exports = { CropSystem };
