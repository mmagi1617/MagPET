export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function normalizeUsername(username) {
  return (username ?? '').trim()
}

export function isValidUsername(username) {
  const value = normalizeUsername(username)

  return /^[A-Za-z0-9_]{3,20}$/.test(value)
}
