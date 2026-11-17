import { supabase } from './supabase.js'

const PAGE_SIZE = 1000

export function monthInputToDate(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Choose a valid budget month.')
  return `${month}-01`
}

export async function fetchMonthBudgets(userId, monthStart) {
  const { data, error } = await supabase
    .from('budgets')
    .select('id,user_id,category_id,budget_type,budget_month,amount,created_at,updated_at')
    .eq('user_id', userId)
    .eq('budget_month', monthStart)
    .order('budget_type', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function fetchMonthExpenses(userId, monthStart) {
  const [year, month] = monthStart.split('-').map(Number)
  const nextMonth = new Date(year, month, 1)
  const nextMonthStart = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`
  const rows = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('expenses')
      .select('id,expense_date,category_id,amount')
      .eq('user_id', userId)
      .gte('expense_date', monthStart)
      .lt('expense_date', nextMonthStart)
      .order('expense_date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return rows
}

export async function saveBudget(userId, values, budgetId) {
  const amount = Number(values.amount)
  const budgetMonth = monthInputToDate(values.budgetMonth)
  const categoryId = values.budgetType === 'category' ? values.categoryId : null
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a budget amount greater than zero.')
  if (!['overall', 'category'].includes(values.budgetType)) throw new Error('Choose a valid budget type.')
  if (values.budgetType === 'category' && !categoryId) throw new Error('Choose an expense category.')
  if (categoryId) {
    const { data, error } = await supabase
      .from('categories')
      .select('id')
      .eq('id', categoryId)
      .eq('user_id', userId)
      .eq('transaction_type', 'expense')
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Choose an expense category owned by your account.')
  }

  const payload = {
    user_id: userId,
    category_id: categoryId,
    budget_type: values.budgetType,
    budget_month: budgetMonth,
    amount,
  }
  let query = supabase.from('budgets')
  if (budgetId) {
    payload.updated_at = new Date().toISOString()
    query = query.update(payload).eq('id', budgetId).eq('user_id', userId)
  } else {
    query = query.insert(payload)
  }
  const { data, error } = await query.select('id,user_id,category_id,budget_type,budget_month,amount,created_at,updated_at').single()
  if (error?.code === '23505') throw new Error('A budget already exists for this category and month. Edit the existing budget instead.')
  if (error?.code === '23514') throw new Error('Choose an expense category owned by your account.')
  if (error) throw error
  return data
}

export async function deleteBudget(userId, budgetId) {
  const { data, error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', budgetId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('This budget could not be found or is no longer available.')
  return data
}

export function getBudgetSpent(budget, expenses, categories, descendantIds) {
  if (budget.budget_type === 'overall') {
    return expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0)
  }
  const categoryIds = new Set([budget.category_id, ...descendantIds(budget.category_id, categories)])
  return expenses.reduce((sum, expense) => categoryIds.has(expense.category_id)
    ? sum + (Number(expense.amount) || 0)
    : sum, 0)
}

export function getBudgetStatus(amount, spent) {
  const percentage = amount > 0 ? (spent / amount) * 100 : 0
  return {
    percentage,
    remaining: amount - spent,
    status: percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'normal',
  }
}
