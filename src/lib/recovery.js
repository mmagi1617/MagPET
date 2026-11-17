export const RECOVERY_STATE_KEY = 'magpet-password-recovery'

export function getRecoveryRequestErrorMessage(error) {
  switch (error?.code) {
    case 'unexpected_failure':
      return 'Supabase could not send the recovery email. Check the project Auth logs for SMTP delivery or Recovery email template errors, then try again.'
    case 'email_address_not_authorized':
      return 'Supabase’s default email service cannot send to this address. Configure a custom SMTP provider in Supabase Auth to send recovery emails to users.'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many recovery email requests were made. Wait a while before trying again.'
    default:
      return error?.message || 'We could not send a recovery code. Please try again.'
  }
}

export function readRecoveryState() {
  try {
    const item = window.sessionStorage.getItem(RECOVERY_STATE_KEY)

    if (!item) {
      return null
    }

    return JSON.parse(item)
  } catch {
    return null
  }
}

export function saveRecoveryState(email, options = {}) {
  const payload = {
    email: (email ?? '').trim().toLowerCase(),
    verified: Boolean(options.verified),
    createdAt: Date.now(),
  }

  window.sessionStorage.setItem(RECOVERY_STATE_KEY, JSON.stringify(payload))

  return payload
}

export function clearRecoveryState() {
  window.sessionStorage.removeItem(RECOVERY_STATE_KEY)
}

export function maskEmail(email) {
  const value = (email ?? '').trim()

  if (!value || !value.includes('@')) {
    return value
  }

  const [local, domain] = value.split('@')
  const visibleLocal = local.length <= 2 ? local.slice(0, 1) : `${local.slice(0, 2)}***`

  return `${visibleLocal}@${domain}`
}
