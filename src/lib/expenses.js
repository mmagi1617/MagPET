import { supabase } from './supabase.js'

export const PAYMENT_METHODS = [
  'Cash',
  'UPI',
  'Debit Card',
  'Credit Card',
  'Net Banking',
  'Other',
]

export const EXPENSE_PAGE_SIZE = 10

const EXPENSE_COLUMNS =
  'id,user_id,expense_date,vendor,description,category_id,payment_mode,amount,notes,created_at,updated_at'

export function toLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getDateBounds(preset, customStart, customEnd) {
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const todayString = toLocalDateString(startOfToday)
  const yesterday = new Date(startOfToday)
  yesterday.setDate(yesterday.getDate() - 1)

  switch (preset) {
    case 'today':
      return { from: todayString, to: todayString }
    case 'yesterday': {
      const date = toLocalDateString(yesterday)
      return { from: date, to: date }
    }
    case 'week': {
      const from = new Date(startOfToday)
      from.setDate(from.getDate() - ((from.getDay() + 6) % 7))
      return { from: toLocalDateString(from), to: todayString }
    }
    case 'month':
      return {
        from: toLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1)),
        to: todayString,
      }
    case 'lastMonth':
      return {
        from: toLocalDateString(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: toLocalDateString(new Date(today.getFullYear(), today.getMonth(), 0)),
      }
    case 'year':
      return { from: `${today.getFullYear()}-01-01`, to: todayString }
    case 'custom':
      return { from: customStart || '', to: customEnd || '' }
    default:
      return { from: '', to: '' }
  }
}

export async function fetchExpenseCategories(userId) {
  const { data, error } = await supabase
    .from('categories')
    .select('id,user_id,name,parent_id,transaction_type')
    .eq('user_id', userId)
    .eq('transaction_type', 'expense')
    .order('name', { ascending: true })

  if (error) throw error
  return data ?? []
}

export function getCategoryLabel(category, categories) {
  const names = [category.name]
  let parentId = category.parent_id
  const visited = new Set([category.id])

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId)
    const parent = categories.find((item) => item.id === parentId)
    if (!parent) break
    names.unshift(parent.name)
    parentId = parent.parent_id
  }

  return names.join(' / ')
}

export async function fetchExpenseSummary(userId) {
  const cents = { all: 0, today: 0, month: 0, year: 0 }
  let count = 0
  const now = new Date()
  const today = toLocalDateString(now)
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const yearStart = `${now.getFullYear()}-01-01`
  const pageSize = 1000
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('expenses')
      .select('amount,expense_date')
      .eq('user_id', userId)
      .order('expense_date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    for (const expense of data ?? []) {
      const amount = Math.round((Number(expense.amount) || 0) * 100)
      cents.all += amount
      count += 1
      if (expense.expense_date === today) cents.today += amount
      if (expense.expense_date >= monthStart && expense.expense_date <= today) {
        cents.month += amount
      }
      if (expense.expense_date >= yearStart && expense.expense_date <= today) {
        cents.year += amount
      }
    }

    if (!data || data.length < pageSize) break
    offset += pageSize
  }

  return {
    all: cents.all / 100,
    count,
    today: cents.today / 100,
    month: cents.month / 100,
    year: cents.year / 100,
  }
}

export async function fetchDashboardExpenses(userId, from, to) {
  const rows = []
  const pageSize = 1000
  let offset = 0
  while (true) {
    let query = supabase
      .from('expenses')
      .select('id,expense_date,vendor,description,category_id,payment_mode,amount')
      .eq('user_id', userId)
      .order('expense_date', { ascending: false })
      .order('id', { ascending: false })
    if (from) query = query.gte('expense_date', from)
    if (to) query = query.lte('expense_date', to)
    const { data, error } = await query.range(offset, offset + pageSize - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
    offset += pageSize
  }
  return rows
}

export async function fetchRecentExpenses(userId, limit = 5) {
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_COLUMNS)
    .eq('user_id', userId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function fetchExpensePage(userId, filters, page) {
  const from = (page - 1) * EXPENSE_PAGE_SIZE
  const to = from + EXPENSE_PAGE_SIZE - 1
  let query = supabase
    .from('expenses')
    .select(EXPENSE_COLUMNS, { count: 'exact' })
    .eq('user_id', userId)

  const bounds = getDateBounds(filters.datePreset, filters.startDate, filters.endDate)
  if (bounds.from) query = query.gte('expense_date', bounds.from)
  if (bounds.to) query = query.lte('expense_date', bounds.to)
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.paymentMode) query = query.eq('payment_mode', filters.paymentMode)

  const search = filters.search.trim().replace(/[,%()\\"]/g, ' ').trim()
  if (search) {
    const pattern = `%${search}%`
    query = query.or(
      `vendor.ilike.${pattern},description.ilike.${pattern},notes.ilike.${pattern}`,
    )
  }

  switch (filters.sort) {
    case 'oldest':
      query = query.order('expense_date', { ascending: true })
      break
    case 'highest':
      query = query.order('amount', { ascending: false })
      break
    case 'lowest':
      query = query.order('amount', { ascending: true })
      break
    default:
      query = query.order('expense_date', { ascending: false })
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to)

  if (error) throw error
  return { expenses: data ?? [], count: count ?? 0 }
}

async function assertExpenseCategory(userId, categoryId) {
  const { data, error } = await supabase
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .eq('user_id', userId)
    .eq('transaction_type', 'expense')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Choose one of your expense categories.')
}

export async function saveExpense(userId, values, expenseId) {
  await assertExpenseCategory(userId, values.category_id)

  const payload = {
    user_id: userId,
    expense_date: values.expense_date,
    vendor: values.vendor.trim(),
    description: values.description.trim() || null,
    category_id: values.category_id,
    payment_mode: values.payment_mode,
    amount: Number(values.amount),
    notes: values.notes.trim() || null,
  }

  let query = supabase.from('expenses')
  if (expenseId) {
    payload.updated_at = new Date().toISOString()
    query = query.update(payload).eq('id', expenseId).eq('user_id', userId)
  } else {
    query = query.insert(payload)
  }

  const { data, error } = await query.select(EXPENSE_COLUMNS).single()
  if (error) throw error
  return data
}

export async function deleteExpense(userId, expenseId) {
  const { data, error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('This expense could not be found or is no longer available.')
  return data
}
