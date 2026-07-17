import { Dashboard } from "@/components/dashboard"
import { loadMonitoringOverview } from "@/lib/monitoring"

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function localInputValue(timestamp: number) {
  const date = new Date(
    timestamp - new Date(timestamp).getTimezoneOffset() * 60000,
  )
  return date.toISOString().slice(0, 16)
}

function readString(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "")
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams
  const now = Date.now()
  const fromInput =
    readString(params.from) || localInputValue(now - 24 * 60 * 60 * 1000)
  const toInput = readString(params.to) || localInputValue(now)
  const userId = readString(params.userId).trim()
  const status = readString(params.status)
  const result = await loadMonitoringOverview({
    userId: userId || undefined,
    from: new Date(fromInput).getTime(),
    to: new Date(toInput).getTime(),
    status: status || undefined,
  })

  return (
    <Dashboard
      data={result.data}
      error={result.error}
      filters={{ userId, from: fromInput, to: toInput, status }}
    />
  )
}
