// 作物生长 - 基于累计光照时间，而不是当前是否白天
class Crop {
  constructor(growthRate = 1, matureAt = 10) {
    this.growth = 0;
    this.lightHours = 0;
    this.growthRate = growthRate;
    this.matureAt = matureAt;
  }

  update(dt, isDay) {
    if (isDay) {
      this.lightHours += dt;
      this.growth += this.growthRate * dt;
    }
  }

  get mature() {
    return this.growth >= this.matureAt;
  }
}

module.exports = { Crop };
