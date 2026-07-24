import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const apiExample = resolve(root, "apps/api/.env.example")
const apiDevVars = resolve(root, "apps/api/.dev.vars")
const mobileExample = resolve(root, "apps/mobile/.env.example")
const mobileEnv = resolve(root, "apps/mobile/.env")
const appExample = resolve(root, "app/.env.example")
const appEnv = resolve(root, "app/.env")

function readArgValue(name) {
  const prefix = `--${name}=`
  const item = process.argv.slice(2).find((arg) => arg.startsWith(prefix))
  return item ? item.slice(prefix.length) : ""
}

const deepseekApiKey =
  readArgValue("deepseek-api-key") || process.env.DEEPSEEK_API_KEY || ""

copyFileSync(apiExample, apiDevVars)
copyFileSync(mobileExample, mobileEnv)
copyFileSync(appExample, appEnv)

if (deepseekApiKey) {
  const content = readFileSync(apiDevVars, "utf8")
  const next = content.replace(
    /^DEEPSEEK_API_KEY=.*$/m,
    `DEEPSEEK_API_KEY=${deepseekApiKey}`,
  )
  writeFileSync(apiDevVars, next)
}

if (!existsSync(apiDevVars) || !existsSync(mobileEnv) || !existsSync(appEnv)) {
  throw new Error("环境文件生成失败")
}

console.log("已生成 apps/api/.dev.vars")
console.log("已生成 apps/mobile/.env")
console.log("已生成 app/.env")
console.log(
  deepseekApiKey
    ? "已写入 DEEPSEEK_API_KEY"
    : "未传入 DEEPSEEK_API_KEY，将使用本地兜底回复",
)
