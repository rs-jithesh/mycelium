import { BALANCE } from '../engine/balance.config'

export function formatBiomass(value: { toNumber?: () => number; toExponential?: (digits: number) => string } | number, useScientific = false) {
  const n = typeof value === 'number' ? value : value.toNumber ? value.toNumber() : Number(value)

  if ((useScientific || n >= BALANCE.NOTATION_SHORTHAND_MAX) && typeof value !== 'number' && value.toExponential) {
    return value.toExponential(2)
  }

  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`

  if (n < 100 && !Number.isInteger(n)) {
    return n.toLocaleString(undefined, {
      minimumFractionDigits: n < 10 ? 2 : 1,
      maximumFractionDigits: 2,
    })
  }

  return Math.floor(n).toLocaleString()
}

export function formatBPS(value: { toNumber?: () => number; toExponential?: (digits: number) => string } | number, useScientific = false) {
  return `${formatBiomass(value, useScientific)}/s`
}
