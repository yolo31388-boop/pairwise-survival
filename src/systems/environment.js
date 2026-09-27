// 环境: 昼夜判断与光照强度。光照在黎明/黄昏平滑过渡, 不做开关式跳变。

function isDaytime(hour, sunrise = 6, sunset = 18) {
  return hour >= sunrise && hour < sunset;
}

// 返回该时刻的光照强度, 范围 [0, 1]。
// 日出后与日落前各有 1 小时的平滑过渡。
function sunlightIntensity(hour, sunrise = 6, sunset = 18) {
  const dawn = sunrise;
  const day = sunrise + 1;
  const dusk = sunset - 1;
  const night = sunset;
  if (hour >= day && hour < dusk) return 1;
  if (hour >= dawn && hour < day) return hour - dawn;
  if (hour >= dusk && hour < night) return night - hour;
  return 0;
}

module.exports = { isDaytime, sunlightIntensity };
