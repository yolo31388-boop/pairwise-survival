// 怪物刷新 - 基于当前时间和已存在怪物数量，夜间补充至上限，不重复刷新、不漏刷
class MonsterSpawner {
  constructor(maxMonsters = 5) {
    this.maxMonsters = maxMonsters;
    this.monsters = [];
    this.nextId = 1;
  }

  isNight(time) {
    return time >= 20 || time < 4;
  }

  update(currentTime) {
    if (this.isNight(currentTime) && this.monsters.length < this.maxMonsters) {
      this.monsters.push({ id: this.nextId++, spawnedAt: currentTime });
    }
    return this.monsters.length;
  }

  clear() {
    this.monsters = [];
  }
}

module.exports = { MonsterSpawner };
