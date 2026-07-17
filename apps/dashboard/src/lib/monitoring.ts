import {
  monitoringOverviewSchema,
  type MonitoringOverview,
} from "@ai-companion/shared"

export type DashboardFilters = {
  userId?: string
  from: number
  to: number
  status?: string
}

export async function loadMonitoringOverview(
  filters: DashboardFilters,
): Promise<{ data?: MonitoringOverview; error?: string }> {
  const apiUrl = process.env.MONITORING_API_URL?.replace(/\/$/, "")
  const apiKey = process.env.MONITORING_API_KEY
  if (!apiUrl || !apiKey) {
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
    const response = await fetch(`${apiUrl}/monitoring/overview?${query}`, {
      headers: { "x-monitoring-key": apiKey },
      cache: "no-store",
    })
    if (!response.ok) {
      return { error: `监控数据读取失败（${response.status}）` }
    }
    return { data: monitoringOverviewSchema.parse(await response.json()) }
  } catch {
    return { error: "无法连接监控 API" }
  }
}
