export function calculateCurrentHearts(
  storedHearts: number,
  lastRefill: Date
): number {
  const hoursElapsed = (Date.now() - lastRefill.getTime()) / 3_600_000
  const recovered = Math.floor(hoursElapsed / 4)
  return Math.min(5, storedHearts + recovered)
}
