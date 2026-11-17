import { supabase } from './supabase.js'
import { getDateBounds, PAYMENT_METHODS, toLocalDateString } from './expenses.js'
import { getCategoryPath } from './categories.js'

export const SAVINGS_PAGE_SIZE = 10
export { PAYMENT_METHODS }

const SAVING_COLUMNS =
  'id,user_id,saving_date,source,description,category_id,payment_mode,amount,notes,created_at,updated_at'

export { getCategoryPath }

export async function fetchSavingCategories(userId) {
  const { data, error } = await supabase
    .from('categories')
    .select('id,user_id,name,parent_id,created_at,transaction_type')
    .eq('user_id', userId)
    .eq('transaction_type', 'saving')
    .order('name', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function fetchSavingsSummary(userId) {
  const totalCents = { all: 0, today: 0, month: 0, year: 0 }
  const categoryCents = new Map()
  const now = new Date()
  const today = toLocalDateString(now)
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const yearStart = `${now.getFullYear()}-01-01`
  const pageSize = 1000
  let offset = 0
  let count = 0

  while (true) {
    const { data, error } = await supabase
      .from('savings')
      .select('amount,saving_date,category_id')
      .eq('user_id', userId)
      .order('saving_date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    for (const saving of data ?? []) {
      const amountCents = Math.round((Number(saving.amount) || 0) * 100)
      totalCents.all += amountCents
      count += 1
      if (saving.saving_date === today) totalCents.today += amountCents
      if (saving.saving_date >= monthStart && saving.saving_date <= today) {
        totalCents.month += amountCents
      }
      if (saving.saving_date >= yearStart && saving.saving_date <= today) {
        totalCents.year += amountCents
      }
      categoryCents.set(
        saving.category_id,
        (categoryCents.get(saving.category_id) ?? 0) + amountCents,
      )
    }

    if (!data || data.length < pageSize) break
    offset += pageSize
  }

  return {
    all: totalCents.all / 100,
    today: totalCents.today / 100,
    month: totalCents.month / 100,
    year: totalCents.year / 100,
    count,
    categoryTotals: Object.fromEntries(
      [...categoryCents.entries()].map(([categoryId, amount]) => [categoryId, amount / 100]),
    ),
  }
}

export async function fetchRecentSavings(userId, limit = 5) {
  const { data, error } = await supabase
    .from('savings')
    .select(SAVING_COLUMNS)
    .eq('user_id', userId)
    .order('saving_date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function fetchSavingsPage(userId, filters, page) {
  const from = (page - 1) * SAVINGS_PAGE_SIZE
  const to = from + SAVINGS_PAGE_SIZE - 1
  let query = supabase
    .from('savings')
    .select(SAVING_COLUMNS, { count: 'exact' })
    .eq('user_id', userId)

  const bounds = getDateBounds(filters.datePreset, filters.startDate, filters.endDate)
  if (bounds.from) query = query.gte('saving_date', bounds.from)
  if (bounds.to) query = query.lte('saving_date', bounds.to)
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.paymentMode) query = query.eq('payment_mode', filters.paymentMode)

  const search = filters.search.trim().replace(/[,%()\\"]/g, ' ').trim()
  if (search) {
    const pattern = `%${search}%`
    query = query.or(`source.ilike.${pattern},description.ilike.${pattern},notes.ilike.${pattern}`)
  }

  switch (filters.sort) {
    case 'oldest':
      query = query.order('saving_date', { ascending: true })
      break
    case 'highest':
      query = query.order('amount', { ascending: false })
      break
    case 'lowest':
      query = query.order('amount', { ascending: true })
      break
    default:
      query = query.order('saving_date', { ascending: false })
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to)

  if (error) throw error
  return { savings: data ?? [], count: count ?? 0 }
}

async function assertSavingCategory(userId, categoryId) {
  const { data, error } = await supabase
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .eq('user_id', userId)
    .eq('transaction_type', 'saving')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Choose one of your saving categories.')
}

export async function saveSaving(userId, values, savingId) {
  const amount = Number(values.amount)
  if (!values.source?.trim()) throw new Error('Enter a source or saving name.')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter an amount greater than zero.')
  if (!values.saving_date) throw new Error('Choose the saving date.')
  if (!PAYMENT_METHODS.includes(values.payment_mode)) throw new Error('Choose a valid payment method.')
  await assertSavingCategory(userId, values.category_id)
  const payload = {
    user_id: userId,
    saving_date: values.saving_date,
    source: values.source.trim(),
    amount,
    category_id: values.category_id,
    payment_mode: values.payment_mode,
    description: values.description.trim() || null,
    notes: values.notes.trim() || null,
  }

  let query = supabase.from('savings')
  if (savingId) {
    payload.updated_at = new Date().toISOString()
    query = query.update(payload).eq('id', savingId).eq('user_id', userId)
  } else {
    query = query.insert(payload)
  }

  const { data, error } = await query.select(SAVING_COLUMNS).single()
  if (error) throw error
  return data
}

export async function deleteSaving(userId, savingId) {
  const { data, error } = await supabase
    .from('savings')
    .delete()
    .eq('id', savingId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('This saving could not be found or is no longer available.')
  return data
}
