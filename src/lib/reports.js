import { supabase } from './supabase.js'

const PAGE_SIZE = 1000
const EXPENSE_REPORT_COLUMNS = 'id,user_id,expense_date,vendor,description,category_id,payment_mode,amount,notes,created_at'
const SAVING_REPORT_COLUMNS = 'id,user_id,saving_date,source,description,category_id,payment_mode,amount,notes,created_at'

async function fetchRows(table, columns, dateColumn, userId, startDate, endDate) {
  const rows = []
  let offset = 0
  while (true) {
    let query = supabase
      .from(table)
      .select(columns)
      .eq('user_id', userId)
      .order(dateColumn, { ascending: false })
      .order('id', { ascending: false })
    if (startDate) query = query.gte(dateColumn, startDate)
    if (endDate) query = query.lte(dateColumn, endDate)
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return rows
}

export async function fetchReportTransactions(userId, startDate, endDate) {
  const [expenses, savings] = await Promise.all([
    fetchRows('expenses', EXPENSE_REPORT_COLUMNS, 'expense_date', userId, startDate, endDate),
    fetchRows('savings', SAVING_REPORT_COLUMNS, 'saving_date', userId, startDate, endDate),
  ])
  return {
    expenses: expenses.map((row) => ({ ...row, type: 'expense', transactionDate: row.expense_date, name: row.vendor || row.description || 'Expense' })),
    savings: savings.map((row) => ({ ...row, type: 'saving', transactionDate: row.saving_date, name: row.source || row.description || 'Saving' })),
  }
}

export function getReportTotals(transactions) {
  return transactions.reduce((totals, transaction) => {
    const amountCents = Math.round((Number(transaction.amount) || 0) * 100)
    if (transaction.type === 'expense') {
      totals.expenseCents += amountCents
      totals.expenseCount += 1
    } else {
      totals.savingCents += amountCents
      totals.savingCount += 1
    }
    return totals
  }, { expenseCents: 0, savingCents: 0, expenseCount: 0, savingCount: 0 })
}

export function aggregateByCategory(expenses, categories) {
  const groups = new Map()
  for (const expense of expenses) {
    const category = categories.find((item) => item.id === expense.category_id)
    const key = category?.id || 'uncategorized'
    const current = groups.get(key) || {
      id: key,
      name: category ? category.name : 'Uncategorized',
      parentId: category?.parent_id || null,
      amount: 0,
      count: 0,
    }
    current.amount += Number(expense.amount) || 0
    current.count += 1
    groups.set(key, current)
  }
  const totalAmount = [...groups.values()].reduce((sum, group) => sum + group.amount, 0)
  return [...groups.values()].map((group) => ({
    ...group,
    percentage: totalAmount > 0 ? (group.amount / totalAmount) * 100 : 0,
    category: categories.find((item) => item.id === group.id) || null,
  }))
}

export function aggregateByDate(transactions, dateCount, startDate) {
  const start = new Date(`${startDate}T00:00:00`)
  const totalsByDate = new Map()
  for (const transaction of transactions) {
    const cents = Math.round((Number(transaction.amount) || 0) * 100)
    totalsByDate.set(transaction.transactionDate, (totalsByDate.get(transaction.transactionDate) || 0) + cents)
  }
  return Array.from({ length: dateCount }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const cents = totalsByDate.get(key) || 0
    return { date: key, amount: cents / 100 }
  })
}

export function aggregateByMonth(transactions, year, type) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, '0')
    const cents = transactions.reduce((sum, transaction) => {
      if (transaction.type !== type || transaction.transactionDate?.slice(0, 7) !== `${year}-${month}`) return sum
      return sum + Math.round((Number(transaction.amount) || 0) * 100)
    }, 0)
    return { month: index, label: new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(year, index, 1)), amount: cents / 100 }
  })
}
