import { getDateBounds, getCategoryLabel } from './expenses.js'
import { formatExpenseDate } from './format.js'
import { supabase } from './supabase.js'

const PAGE_SIZE = 1000

function csvCell(value) {
  let text = value == null ? '' : String(value)
  if (/^[\s]*[=+@]/.test(text) || /^[\s]*-/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export function rowsToCsv(rows, columns) {
  const header = columns.map((column) => csvCell(column.label)).join(',')
  const body = rows.map((row) => columns.map((column) => csvCell(row[column.key])).join(','))
  return `\uFEFF${[header, ...body].join('\r\n')}`
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadSpreadsheet({ rows, columns, filename, format }) {
  if (!rows.length) return 0
  if (format === 'csv') {
    saveBlob(new Blob([rowsToCsv(rows, columns)], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`)
    return rows.length
  }
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'MagPET'
  workbook.created = new Date()
  const worksheet = workbook.addWorksheet('Transactions', { views: [{ state: 'frozen', ySplit: 1 }] })
  worksheet.columns = columns.map((column) => ({
    header: column.label,
    key: column.key,
    width: column.width || Math.max(column.label.length + 2, 16),
  }))
  worksheet.addRows(rows)
  worksheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + columns.length)}1` }
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D7181' } }
  worksheet.getRow(1).height = 22
  const buffer = await workbook.xlsx.writeBuffer()
  saveBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filename}.xlsx`)
  return rows.length
}

export async function fetchExportRows(kind, userId, filters, categories) {
  const isExpense = kind === 'expense'
  const dateColumn = isExpense ? 'expense_date' : 'saving_date'
  const nameColumn = isExpense ? 'vendor' : 'source'
  const table = isExpense ? 'expenses' : 'savings'
  const selectColumns = `id,${dateColumn},${nameColumn},description,category_id,payment_mode,amount,notes`
  const bounds = getDateBounds(filters.datePreset, filters.startDate, filters.endDate)
  const rows = []
  let offset = 0
  while (true) {
    let query = supabase.from(table).select(selectColumns).eq('user_id', userId)
    if (bounds.from) query = query.gte(dateColumn, bounds.from)
    if (bounds.to) query = query.lte(dateColumn, bounds.to)
    if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
    if (filters.paymentMode) query = query.eq('payment_mode', filters.paymentMode)
    const search = (filters.search || '').trim().replace(/[,%()\\"]/g, ' ').trim()
    if (search) {
      const pattern = `%${search}%`
      query = isExpense
        ? query.or(`vendor.ilike.${pattern},description.ilike.${pattern},notes.ilike.${pattern}`)
        : query.or(`source.ilike.${pattern},description.ilike.${pattern},notes.ilike.${pattern}`)
    }
    query = query.order(dateColumn, { ascending: filters.sort === 'oldest' })
    if (filters.sort === 'highest' || filters.sort === 'lowest') {
      query = query.order('amount', { ascending: filters.sort === 'lowest' })
    }
    const { data, error } = await query.order('id', { ascending: false }).range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return rows.map((row) => {
    const category = categories.find((item) => item.id === row.category_id)
    return {
      date: formatExpenseDate(row[dateColumn]),
      name: row[nameColumn] || '',
      description: row.description || '',
      category: category ? getCategoryLabel(category, categories) : 'Uncategorized',
      paymentMode: row.payment_mode || '',
      amount: Number(row.amount) || 0,
      notes: row.notes || '',
    }
  })
}

export const EXPENSE_EXPORT_COLUMNS = [
  { key: 'date', label: 'Expense Date', width: 18 },
  { key: 'name', label: 'Vendor', width: 28 },
  { key: 'description', label: 'Description', width: 36 },
  { key: 'category', label: 'Category', width: 28 },
  { key: 'paymentMode', label: 'Payment Method', width: 20 },
  { key: 'amount', label: 'Amount (INR)', width: 16 },
  { key: 'notes', label: 'Notes', width: 36 },
]

export const SAVING_EXPORT_COLUMNS = [
  { key: 'date', label: 'Saving Date', width: 18 },
  { key: 'name', label: 'Source', width: 28 },
  { key: 'description', label: 'Description', width: 36 },
  { key: 'category', label: 'Category', width: 28 },
  { key: 'paymentMode', label: 'Payment Method', width: 20 },
  { key: 'amount', label: 'Amount (INR)', width: 16 },
  { key: 'notes', label: 'Notes', width: 36 },
]

export const REPORT_EXPORT_COLUMNS = [
  { key: 'date', label: 'Date', width: 18 },
  { key: 'name', label: 'Name / Source', width: 28 },
  { key: 'category', label: 'Category', width: 28 },
  { key: 'type', label: 'Transaction Type', width: 18 },
  { key: 'paymentMode', label: 'Payment Method', width: 20 },
  { key: 'amount', label: 'Amount (INR)', width: 16 },
  { key: 'description', label: 'Description', width: 36 },
]

export function makeExportFilename(kind, period) {
  const suffix = period?.from && period?.to
    ? period.from === period.to ? period.from : `${period.from}_to_${period.to}`
    : new Date().getFullYear()
  return `MagPET_${kind}_${suffix}`
}
