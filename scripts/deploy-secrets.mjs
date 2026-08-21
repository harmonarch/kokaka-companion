// 在部署前把生产环境 secret 同步到 Cloudflare Workers。
//
// 用法：
//   node scripts/deploy-secrets.mjs            # 同步 dashboard 与 api 两个 Worker
//   node scripts/deploy-secrets.mjs dashboard  # 只同步 dashboard
//   node scripts/deploy-secrets.mjs api        # 只同步 api
//
// secret 来源是各 app 目录下的 .env.production（git 忽略），
// 复制自对应的 .env.production.example 并填入真实值。
// 值为空的 key 会被跳过，避免误把空字符串写进 Worker。
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const WORKERS = {
  dashboard: {
    dir: "apps/dashboard",
    config: "wrangler.jsonc",
  },
  api: {
    dir: "apps/api",
    config: "wrangler.production.toml",
  },
}

function parseDotenv(text) {
  const result = {}
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key) result[key] = value
  }
  return result
}

function syncWorker(name, worker) {
  const appDir = resolve(root, worker.dir)
  const envFile = resolve(appDir, ".env.production")

  if (!existsSync(envFile)) {
    console.error(`✗ ${name}: 缺少 ${worker.dir}/.env.production`)
    console.error(
      `  先执行：cp ${worker.dir}/.env.production.example ${worker.dir}/.env.production 并填入真实值`,
    )
    return false
  }

  const secrets = parseDotenv(readFileSync(envFile, "utf8"))
  const filled = Object.fromEntries(
    Object.entries(secrets).filter(([, value]) => value !== ""),
  )
  const emptyKeys = Object.entries(secrets)
    .filter(([, value]) => value === "")
    .map(([key]) => key)

  if (emptyKeys.length > 0) {
    console.warn(`⚠ ${name}: 以下 secret 为空，已跳过：${emptyKeys.join(", ")}`)
  }
  if (Object.keys(filled).length === 0) {
    console.error(`✗ ${name}: ${worker.dir}/.env.production 中没有可用的 secret`)
    return false
  }

  console.log(`→ ${name}: 同步 ${Object.keys(filled).length} 个 secret ...`)
  const result = spawnSync(
    "pnpm",
    ["exec", "wrangler", "secret", "bulk", "--config", worker.config],
    {
      cwd: appDir,
      input: JSON.stringify(filled),
      stdio: ["pipe", "inherit", "inherit"],
    },
  )
  if (result.error || result.status !== 0) {
    console.error(`✗ ${name}: secret 同步失败`)
    return false
  }
  return true
}

const targets = process.argv.slice(2).filter((arg) => !arg.startsWith("-"))
const selected = targets.length === 0 ? Object.keys(WORKERS) : targets

const unknown = selected.filter((name) => !(name in WORKERS))
if (unknown.length > 0) {
  console.error(
    `未知目标：${unknown.join(", ")}（可选：${Object.keys(WORKERS).join(" / ")}）`,
  )
  process.exit(1)
}

let ok = true
for (const name of selected) {
  ok = syncWorker(name, WORKERS[name]) && ok
}
if (!ok) {
  process.exit(1)
}
console.log("✓ 全部 secret 同步完成")
