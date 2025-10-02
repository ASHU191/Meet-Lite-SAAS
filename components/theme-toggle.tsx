// 'use client'
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return (localStorage.getItem("theme") ?? "light") === "dark"
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    if (isDark) {
      root.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      root.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }, [isDark, mounted])

  if (!mounted) return null

  return (
    <Button variant="ghost" size="sm" aria-label="Toggle theme" onClick={() => setIsDark((v) => !v)}>
      {isDark ? "Light" : "Dark"}
    </Button>
  )
}
