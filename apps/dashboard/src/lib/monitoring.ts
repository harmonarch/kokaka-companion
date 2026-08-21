import {
  monitoringOverviewSchema,
  type MonitoringOverview,
} from "@ai-companion/shared"
import { getCloudflareContext } from "@opennextjs/cloudflare"

declare global {
  interface CloudflareEnv {
    MONITORING_API?: {
      fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
    }
    MONITORING_API_KEY?: string
  }
}

export type DashboardFilters = {
  userId?: string
  from: number
  to: number
  status?: string
}

export async function loadMonitoringOverview(
  filters: DashboardFilters,
): Promise<{ data?: MonitoringOverview; error?: string }> {
  let service: CloudflareEnv["MONITORING_API"]
  let apiKey = process.env.MONITORING_API_KEY
  try {
    const { env } = getCloudflareContext()
    service = env.MONITORING_API
    apiKey = env.MONITORING_API_KEY ?? apiKey
  } catch {
    // next dev uses the local URL and key from .env files.
  }

  const apiUrl = process.env.MONITORING_API_URL?.replace(/\/$/, "")
  if ((!service && !apiUrl) || !apiKey) {
    return { error: "尚未配置监控数据连接" }
  }

  const query = new URLSearchParams({
    from: String(filters.from),
    to: String(filters.to),
    limit: "100",
  })
  if (filters.userId) query.set("userId", filters.userId)
  if (filters.status) query.set("status", filters.status)

  try {
    const request = new Request(
      `${apiUrl ?? "https://monitoring-api.internal"}/monitoring/overview?${query}`,
      {
        headers: { "x-monitoring-key": apiKey },
        cache: "no-store",
      },
    )
    const response = service
      ? await service.fetch(request)
      : await fetch(request)
    if (!response.ok) {
      return { error: `监控数据读取失败（${response.status}）` }
    }
    return { data: monitoringOverviewSchema.parse(await response.json()) }
  } catch {
    return { error: "无法连接监控 API" }
  }
}
