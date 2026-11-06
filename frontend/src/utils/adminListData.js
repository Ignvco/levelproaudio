// Read the actual admin API fields; missing values are not zero or "customer".
export function enrollmentProgress(enrollment) {
  const value = enrollment?.progress ?? enrollment?.progress_percentage
  if (!["number", "string"].includes(typeof value) || String(value).trim() === "") return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null
}

export function adminUserRole(user) {
  if (user?.is_superuser === true) return "super"
  if (user?.is_staff === true) return "admin"
  if (user?.is_superuser === false && user?.is_staff === false) return "cliente"
  return "unknown"
}
