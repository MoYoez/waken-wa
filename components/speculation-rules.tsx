'use client'

import { useEffect } from 'react'

type SpeculationRulesProps = {
  id: string
  rulesJson: string
}

export function SpeculationRules({ id, rulesJson }: SpeculationRulesProps) {
  useEffect(() => {
    const normalizedRules = rulesJson.trim()
    if (!normalizedRules) return

    const existing = document.getElementById(id)
    if (
      existing instanceof HTMLScriptElement &&
      existing.type === 'speculationrules' &&
      existing.textContent === normalizedRules
    ) {
      return
    }

    existing?.remove()

    const script = document.createElement('script')
    script.id = id
    script.type = 'speculationrules'
    script.textContent = normalizedRules
    document.head.appendChild(script)

    return () => {
      if (script.isConnected) {
        script.remove()
      }
    }
  }, [id, rulesJson])

  return null
}
