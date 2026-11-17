import { normalizeUsername, isValidUsername } from './validation.js'
import { supabase } from './supabase.js'

export async function fetchOwnProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,full_name,username,created_at,updated_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Your profile record is unavailable. Contact support if this continues.')
  return data
}

export async function updateOwnProfile(userId, values) {
  const fullName = values.fullName.trim().replace(/\s+/g, ' ')
  const username = normalizeUsername(values.username).toLowerCase()
  if (!fullName) throw new Error('Enter your full name.')
  if (!isValidUsername(username)) throw new Error('Username must be 3–20 characters and use letters, numbers, or underscores.')

  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, username })
    .eq('id', userId)
    .select('id,full_name,username,created_at,updated_at')
    .single()

  if (error?.code === '23505' || error?.message?.includes('profiles_username_ci_unique_idx')) {
    throw new Error('That username is already in use. Choose another one.')
  }
  if (error) throw error
  return data
}

export async function updateOwnPassword(password, confirmation) {
  if (password.length < 8) throw new Error('Password must be at least 8 characters long.')
  if (password !== confirmation) throw new Error('The passwords do not match.')
  const { data, error } = await supabase.auth.updateUser({ password })
  if (error) throw error
  if (!data.user) throw new Error('Your session is no longer available. Sign in again and retry.')
  return data.user
}
