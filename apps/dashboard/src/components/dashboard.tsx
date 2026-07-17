import type {
  MonitoringEvent,
  MonitoringOverview,
  MonitoringTrace,
} from "@ai-companion/shared"
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  Clock3,
  Database,
  Sparkles,
  TimerReset,
  Zap,
} from "lucide-react"
import { SectionNavigation } from "./section-navigation"
import { SearchFilters } from "./search-filters"

const statusLabels = {
  started: "进行中",
  ok: "正常",
  degraded: "降级",
  partial: "部分失败",
  failed: "失败",
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value)
}

function formatDuration(value: number | null) {
  if (value == null) return "--"
  if (value < 1000) return `${value} ms`
  return `${(value / 1000).toFixed(2)} s`
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value)
}

function formatRange(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

function shortId(value: string) {
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value
}

function Status({ value }: { value: MonitoringTrace["status"] }) {
  return (
    <span className={`status status-${value}`}>
      <span />
      {statusLabels[value]}
    </span>
  )
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  label: string
  value: string
  detail: string
  icon: typeof Activity
  tone?: "neutral" | "good" | "warn"
}) {
  return (
    <div className={`metric metric-${tone}`}>
      <div className="metric-heading">
        <span>{label}</span>
        <Icon size={17} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

function TrendChart({ traces }: { traces: MonitoringTrace[] }) {
  const buckets = Array.from({ length: 12 }, (_, index) => {
    const max = traces[0]?.startedAt ?? Date.now()
    const min = traces.at(-1)?.startedAt ?? max - 1
    const width = Math.max((max - min) / 12, 1)
    const start = min + index * width
    const grouped = traces.filter(
      (trace) => trace.startedAt >= start && trace.startedAt < start + width,
    )
    return {
      total: grouped.length,
      unhealthy: grouped.filter((trace) =>
        ["degraded", "partial", "failed"].includes(trace.status),
      ).length,
    }
  })
  const max = Math.max(...buckets.map((bucket) => bucket.total), 1)

  return (
    <div className="trend-chart" aria-label="链路趋势图">
      {buckets.map((bucket, index) => (
        <div className="trend-column" key={index}>
          <div
            className="trend-errors"
            style={{ height: `${(bucket.unhealthy / max) * 100}%` }}
          />
          <div
            className="trend-total"
            style={{ height: `${(bucket.total / max) * 100}%` }}
          />
        </div>
      ))}
    </div>
  )
}

function StageBreakdown({ events }: { events: MonitoringEvent[] }) {
  const groups = Object.entries(
    events.reduce<Record<string, { count: number; failed: number }>>(
      (result, event) => {
        const family = event.stage.split(".")[0] ?? "other"
        result[family] ??= { count: 0, failed: 0 }
        result[family].count += 1
        if (["degraded", "partial", "failed"].includes(event.status)) {
          result[family].failed += 1
        }
        return result
      },
      {},
    ),
  ).sort((left, right) => right[1].count - left[1].count)
  const max = Math.max(...groups.map(([, value]) => value.count), 1)

  return (
    <div className="stage-list">
      {groups.length === 0 ? (
        <p className="empty-inline">当前范围内没有阶段事件</p>
      ) : (
        groups.slice(0, 6).map(([name, value]) => (
          <div className="stage-row" key={name}>
            <span className="stage-name">{name}</span>
            <div className="stage-track">
              <span style={{ width: `${(value.count / max) * 100}%` }} />
            </div>
            <strong>{value.count}</strong>
            <small>{value.failed ? `${value.failed} 异常` : "正常"}</small>
          </div>
        ))
      )}
    </div>
  )
}

function TraceTable({ traces }: { traces: MonitoringTrace[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>状态</th>
            <th>Trace ID</th>
            <th>用户</th>
            <th>开始时间</th>
            <th>首字延迟</th>
            <th>总耗时</th>
            <th>Token</th>
            <th>模型调用</th>
            <th aria-label="详情" />
          </tr>
        </thead>
        <tbody>
          {traces.map((trace) => (
            <tr key={trace.traceId}>
              <td>
                <Status value={trace.status} />
              </td>
              <td className="mono" title={trace.traceId}>
                {shortId(trace.traceId)}
              </td>
              <td className="mono" title={trace.userId}>
                {shortId(trace.userId)}
              </td>
              <td>{formatTime(trace.startedAt)}</td>
              <td>{formatDuration(trace.firstResponseMs)}</td>
              <td>{formatDuration(trace.totalDurationMs)}</td>
              <td>{formatNumber(trace.totalTokens)}</td>
              <td>{trace.modelCallCount}</td>
              <td>
                <ChevronRight size={16} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {traces.length === 0 && (
        <div className="empty-table">当前筛选范围内没有监控记录</div>
      )}
    </div>
  )
}

function EventTable({ events }: { events: MonitoringEvent[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>状态</th>
            <th>阶段</th>
            <th>发生时间</th>
            <th>耗时</th>
            <th>Provider / Model</th>
            <th>Token</th>
            <th>错误码</th>
            <th>外部追踪</th>
          </tr>
        </thead>
        <tbody>
          {events.slice(0, 100).map((event) => (
            <tr key={event.id}>
              <td>
                <Status value={event.status} />
              </td>
              <td className="mono">{event.stage}</td>
              <td>{formatTime(event.occurredAt)}</td>
              <td>{formatDuration(event.durationMs)}</td>
              <td>
                {[event.provider, event.model].filter(Boolean).join(" / ") ||
                  "--"}
              </td>
              <td>
                {event.totalTokens == null
                  ? "--"
                  : formatNumber(event.totalTokens)}
              </td>
              <td className="mono event-error">{event.errorCode ?? "--"}</td>
              <td className="mono" title={event.externalTraceId ?? ""}>
                {event.externalTraceId ? shortId(event.externalTraceId) : "--"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {events.length === 0 && (
        <div className="empty-table">当前筛选范围内没有阶段事件</div>
      )}
    </div>
  )
}

export function Dashboard({
  data,
  error,
  filters,
}: {
  data?: MonitoringOverview
  error?: string
  filters: { userId: string; from: string; to: string; status: string }
}) {
  const summary = data?.summary
  const healthRate = summary?.totalTraces
    ? Math.round((summary.healthyTraces / summary.totalTraces) * 100)
    : 0
  const storageAttempts = (data?.traces.length ?? 0) * 4
  const storageOk = Math.max(
    storageAttempts - (summary?.storageFailureCount ?? 0),
    0,
  )

  return (
    <div className="app-shell">
      <SectionNavigation />

      <main>
        <header className="topbar">
          <div className="topbar-title">
            <span className="eyebrow">KOKAKA OPERATIONS</span>
            <h1>系统可观测性</h1>
          </div>
          <div className="range-summary" aria-label="当前查询范围">
            <Clock3 size={15} />
            <span>{formatRange(filters.from)}</span>
            <span className="range-divider">至</span>
            <span>{formatRange(filters.to)}</span>
            {filters.userId ? <strong>{shortId(filters.userId)}</strong> : null}
          </div>
          <div className={`connection ${error ? "offline" : ""}`}>
            <span className="connection-dot" />
            {error ? "连接异常" : "实时数据"}
          </div>
          <SearchFilters filters={filters} />
        </header>

        {error ? (
          <section className="connection-error">
            <AlertTriangle size={22} />
            <div>
              <strong>{error}</strong>
              <span>检查 dashboard 与 Worker 的监控连接配置。</span>
            </div>
          </section>
        ) : null}

        <section className="metrics" id="overview">
          <Metric
            label="链路总数"
            value={formatNumber(summary?.totalTraces ?? 0)}
            detail={`${summary?.activeTraces ?? 0} 条仍在进行`}
            icon={Activity}
          />
          <Metric
            label="健康率"
            value={`${healthRate}%`}
            detail={`${summary?.unhealthyTraces ?? 0} 条异常链路`}
            icon={Check}
            tone={healthRate >= 95 ? "good" : "warn"}
          />
          <Metric
            label="平均首字延迟"
            value={formatDuration(summary?.averageFirstResponseMs ?? null)}
            detail="用户发送至首次响应"
            icon={Zap}
          />
          <Metric
            label="平均总耗时"
            value={formatDuration(summary?.averageDurationMs ?? null)}
            detail="完整回复与持久化"
            icon={TimerReset}
          />
          <Metric
            label="Token 总量"
            value={formatNumber(summary?.totalTokens ?? 0)}
            detail={`${summary?.totalModelCalls ?? 0} 次模型调用`}
            icon={Sparkles}
          />
        </section>

        <section className="overview-grid">
          <article className="panel trend-panel">
            <div className="panel-title">
              <div>
                <h2>链路趋势</h2>
                <p>当前时间范围内的运行量与异常</p>
              </div>
              <div className="legend">
                <span className="legend-all">全部</span>
                <span className="legend-error">异常</span>
              </div>
            </div>
            <TrendChart traces={data?.traces ?? []} />
          </article>
          <article className="panel status-panel" id="errors">
            <div className="panel-title">
              <div>
                <h2>运行状态</h2>
                <p>完整链路最终结果</p>
              </div>
            </div>
            <div
              className="health-ring"
              style={
                { "--health": `${healthRate * 3.6}deg` } as React.CSSProperties
              }
            >
              <div>
                <strong>{healthRate}%</strong>
                <span>健康</span>
              </div>
            </div>
            <div className="status-summary">
              <div>
                <span className="dot good" />
                正常<strong>{summary?.healthyTraces ?? 0}</strong>
              </div>
              <div>
                <span className="dot warn" />
                异常<strong>{summary?.unhealthyTraces ?? 0}</strong>
              </div>
              <div>
                <span className="dot active" />
                进行中<strong>{summary?.activeTraces ?? 0}</strong>
              </div>
            </div>
          </article>
        </section>

        <section className="overview-grid lower-grid">
          <article className="panel" id="models">
            <div className="panel-title">
              <div>
                <h2>阶段与模型调用</h2>
                <p>LLM、Memory 与 Storage 事件分布</p>
              </div>
            </div>
            <StageBreakdown events={data?.events ?? []} />
          </article>
          <article className="panel storage-panel" id="storage">
            <div className="panel-title">
              <div>
                <h2>存储完整性</h2>
                <p>D1、KV、Memory 与 Vectorize</p>
              </div>
              <Database size={20} />
            </div>
            <div className="storage-score">
              <strong>
                {storageAttempts
                  ? Math.round((storageOk / storageAttempts) * 100)
                  : 0}
                %
              </strong>
              <span>成功写入</span>
            </div>
            <div className="storage-bar">
              <span
                style={{
                  width: `${storageAttempts ? (storageOk / storageAttempts) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="storage-note">
              <Clock3 size={15} />
              {summary?.storageFailureCount ?? 0} 个链路发生存储失败
            </p>
          </article>
        </section>

        <section className="panel traces-panel" id="traces">
          <div className="panel-title">
            <div>
              <h2>最近链路</h2>
              <p>最多显示 100 条，按开始时间倒序</p>
            </div>
            <strong>{data?.traces.length ?? 0} 条</strong>
          </div>
          <TraceTable traces={data?.traces ?? []} />
        </section>

        <section className="panel traces-panel events-panel">
          <div className="panel-title">
            <div>
              <h2>阶段事件明细</h2>
              <p>耗时、模型、Token、错误与外部追踪编号</p>
            </div>
            <strong>{data?.events.length ?? 0} 条</strong>
          </div>
          <EventTable events={data?.events ?? []} />
        </section>
      </main>
    </div>
  )
}
