export function randomId(len = 10) {
  const s = Math.random().toString(36).slice(2)
  return s.slice(0, len)
}
