"use client"

import { Activity, Bot, Database, Gauge, TriangleAlert } from "lucide-react"
import { useEffect, useRef, useState } from "react"

const sections = [
  { id: "overview", label: "总览", icon: Gauge },
  { id: "traces", label: "链路", icon: Activity },
  { id: "models", label: "模型调用", icon: Bot },
  { id: "storage", label: "存储与记忆", icon: Database },
  { id: "errors", label: "异常", icon: TriangleAlert },
] as const

export function SectionNavigation() {
  const [activeSection, setActiveSection] = useState("overview")
  const selectionLockUntil = useRef(0)

  useEffect(() => {
    const elements = sections
      .map(({ id }) => document.getElementById(id))
      .filter((element): element is HTMLElement => element != null)
    const updateActiveSection = () => {
      if (Date.now() < selectionLockUntil.current) return

      const readingLine = window.innerHeight * 0.22
      const closest = elements.reduce(
        (current, element) => {
          const distance = Math.abs(
            element.getBoundingClientRect().top - readingLine,
          )
          return distance < current.distance ? { element, distance } : current
        },
        { element: elements[0], distance: Number.POSITIVE_INFINITY },
      )

      if (closest.element) setActiveSection(closest.element.id)
    }

    updateActiveSection()
    window.addEventListener("scroll", updateActiveSection, { passive: true })
    window.addEventListener("resize", updateActiveSection)
    return () => {
      window.removeEventListener("scroll", updateActiveSection)
      window.removeEventListener("resize", updateActiveSection)
    }
  }, [])

  return (
    <aside className="section-nav" aria-label="主导航">
      <a className="nav-brand" href="#overview" aria-label="Kokaka 总览">
        <span>K</span>
      </a>
      <nav>
        {sections.map(({ id, label, icon: Icon }) => (
          <a
            className={activeSection === id ? "active" : undefined}
            href={`#${id}`}
            aria-label={label}
            aria-current={activeSection === id ? "location" : undefined}
            data-label={label}
            key={id}
            onClick={() => {
              selectionLockUntil.current = Date.now() + 700
              setActiveSection(id)
            }}
          >
            <Icon size={19} strokeWidth={1.8} />
          </a>
        ))}
      </nav>
      <span className="nav-status" title="数据已连接" />
    </aside>
  )
}
