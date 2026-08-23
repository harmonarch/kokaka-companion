// 危机干预资源：心理援助热线与紧急求助渠道。
// 热线即当前可落地的人工干预出口（真人咨询师），并补充 120/110 紧急渠道。
export const CRISIS_HOTLINE = "12356" // 全国统一心理援助热线
export const CRISIS_HOTLINE_BEIJING = "010-82951332" // 北京心理危机研究与干预中心（24 小时）

export const CRISIS_RESOURCE_TEXT =
  "如果你此刻有立即伤害自己或他人的风险，请先保证安全：立刻拨打 120（急救）或 110（报警），并尽量让身边可信的人陪着你。" +
  "你也可以随时联系心理援助热线：全国统一心理援助热线 12356（24 小时）；北京心理危机研究与干预中心 010-82951332（24 小时）。"

export function appendCrisisResources(reply: string) {
  if (reply.includes(CRISIS_HOTLINE) || reply.includes(CRISIS_HOTLINE_BEIJING)) {
    return reply
  }
  return `${reply.trim()}\n\n${CRISIS_RESOURCE_TEXT}`
}
