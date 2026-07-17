"use client"

import { Search, Users, X } from "lucide-react"
import { useEffect, useState } from "react"

type Filters = {
  userId: string
  from: string
  to: string
  status: string
}

export function SearchFilters({ filters }: { filters: Filters }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", close)
    return () => window.removeEventListener("keydown", close)
  }, [open])

  return (
    <>
      <button
        className="search-entry"
        type="button"
        aria-expanded={open}
        aria-controls="dashboard-search"
        onClick={() => setOpen(true)}
      >
        <Search size={17} />
        筛选记录
      </button>

      {open ? (
        <div
          className="search-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <section
            className="search-panel"
            id="dashboard-search"
            role="dialog"
            aria-modal="true"
            aria-labelledby="search-title"
          >
            <div className="search-panel-heading">
              <div>
                <span className="eyebrow">QUERY CONTROLS</span>
                <h2 id="search-title">筛选监控记录</h2>
                <p>缩小查询范围，快速定位一次对话或异常</p>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="关闭搜索"
                title="关闭搜索"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form className="filters" method="get">
              <label>
                <span>用户 ID</span>
                <div className="input-wrap">
                  <Users size={16} />
                  <input
                    name="userId"
                    defaultValue={filters.userId}
                    placeholder="全部用户"
                    autoFocus
                  />
                </div>
              </label>
              <label>
                <span>开始时间</span>
                <input
                  type="datetime-local"
                  name="from"
                  defaultValue={filters.from}
                />
              </label>
              <label>
                <span>结束时间</span>
                <input
                  type="datetime-local"
                  name="to"
                  defaultValue={filters.to}
                />
              </label>
              <label>
                <span>状态</span>
                <select name="status" defaultValue={filters.status}>
                  <option value="">全部状态</option>
                  <option value="ok">正常</option>
                  <option value="degraded">降级</option>
                  <option value="partial">部分失败</option>
                  <option value="failed">失败</option>
                  <option value="started">进行中</option>
                </select>
              </label>
              <button type="submit">
                <Search size={17} />
                查询
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  )
}
