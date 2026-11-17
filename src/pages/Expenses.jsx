import { useEffect, useMemo, useState } from 'react'
import { ArrowDownUp, ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import ExpenseForm from '../components/ExpenseForm.jsx'
import ExpenseSummary from '../components/ExpenseSummary.jsx'
import ExportActions from '../components/ExportActions.jsx'
import { useAuth } from '../context/useAuth.js'
import {
  deleteExpense,
  EXPENSE_PAGE_SIZE,
  fetchExpenseCategories,
  fetchExpensePage,
  fetchExpenseSummary,
  getDateBounds,
  getCategoryLabel,
  PAYMENT_METHODS,
  saveExpense,
} from '../lib/expenses.js'
import { downloadSpreadsheet, EXPENSE_EXPORT_COLUMNS, fetchExportRows, makeExportFilename } from '../lib/exports.js'
import { formatExpenseDate, formatRupees } from '../lib/format.js'
import '../styles/expenses.css'

const initialFilters = {
  search: '',
  datePreset: '',
  startDate: '',
  endDate: '',
  categoryId: '',
  paymentMode: '',
  sort: 'latest',
}

function ExpensePage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [expenses, setExpenses] = useState([])
  const [summary, setSummary] = useState(null)
  const [filters, setFilters] = useState(initialFilters)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [overviewError, setOverviewError] = useState('')
  const [listError, setListError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [toast, setToast] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const categoryOptions = useMemo(
    () => categories.map((category) => ({
      ...category,
      label: getCategoryLabel(category, categories),
    })),
    [categories],
  )
  const categoryNames = useMemo(
    () => new Map(categoryOptions.map((category) => [category.id, category.label])),
    [categoryOptions],
  )
  const appliedFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [debouncedSearch, filters],
  )
  const customRangeInvalid = Boolean(
    filters.datePreset === 'custom' && filters.startDate && filters.endDate && filters.startDate > filters.endDate,
  )
  const pageCount = Math.max(1, Math.ceil(totalCount / EXPENSE_PAGE_SIZE))

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search), 250)
    return () => window.clearTimeout(timer)
  }, [filters.search])

  useEffect(() => {
    let active = true

    async function loadOverview() {
      setSummaryLoading(true)
      setOverviewError('')

      try {
        const [categoryRows, summaryData] = await Promise.all([
          fetchExpenseCategories(user.id),
          fetchExpenseSummary(user.id),
        ])
        if (!active) return
        setCategories(categoryRows)
        setSummary(summaryData)
      } catch (error) {
        if (!active) return
        setOverviewError(error.message || 'Unable to load your expense overview.')
      } finally {
        if (active) setSummaryLoading(false)
      }
    }

    loadOverview()
    return () => { active = false }
  }, [refreshKey, user.id])

  useEffect(() => {
    let active = true

    async function loadExpensePage() {
      setLoading(true)
      setListError('')
      if (customRangeInvalid) {
        setExpenses([])
        setTotalCount(0)
        setLoading(false)
        return
      }

      try {
        const result = await fetchExpensePage(user.id, appliedFilters, page)
        if (!active) return
        setExpenses(result.expenses)
        setTotalCount(result.count)
      } catch (error) {
        if (active) setListError(error.message || 'Unable to load expenses. Check your connection and try again.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadExpensePage()
    return () => { active = false }
  }, [appliedFilters, customRangeInvalid, page, refreshKey, user.id])

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }))
    setPage(1)
  }

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3500)
  }

  async function handleSave(values) {
    if (saving) return
    setSaving(true)
    try {
      await saveExpense(user.id, values, editing?.id)
      setEditing(null)
      setPage(1)
      setRefreshKey((value) => value + 1)
      showToast(editing ? 'Expense updated.' : 'Expense added.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await deleteExpense(user.id, deleteTarget.id)
      setDeleteTarget(null)
      if (expenses.length === 1 && page > 1) setPage((value) => value - 1)
      setRefreshKey((value) => value + 1)
      showToast('Expense deleted.')
    } catch (error) {
      setListError(error.message || 'Unable to delete this expense.')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  function resetFilters() {
    setFilters(initialFilters)
    setDebouncedSearch('')
    setPage(1)
  }

  const editInitialValues = editing ? {
    vendor: editing.vendor ?? '',
    amount: String(editing.amount ?? ''),
    category_id: editing.category_id ?? '',
    expense_date: editing.expense_date ?? '',
    payment_mode: editing.payment_mode ?? '',
    description: editing.description ?? '',
    notes: editing.notes ?? '',
  } : null

  return (
    <div className="app-shell">
      <main className="expense-page">
        <section className="expense-page__intro">
          <div>
            <p className="eyebrow">YOUR MONEY, MADE CLEAR</p>
            <h1>Expense management</h1>
            <p>Record everyday spending, then find any transaction when you need it.</p>
          </div>
          <div className="expense-page__actions"><ExportActions onExport={async (format) => {
            if (customRangeInvalid) throw new Error('Choose a valid custom date range before exporting.')
            const rows = await fetchExportRows('expense', user.id, appliedFilters, categories)
            const bounds = getDateBounds(appliedFilters.datePreset, appliedFilters.startDate, appliedFilters.endDate)
            return downloadSpreadsheet({ rows, columns: EXPENSE_EXPORT_COLUMNS, filename: makeExportFilename('Expenses', bounds), format })
          }} /><a className="button button--primary" href="#add-expense"><Plus aria-hidden="true" size={17} /> Add expense</a></div>
        </section>

        <ExpenseSummary loading={summaryLoading} summary={summary} />

        {overviewError && <p className="form-message form-message--error expense-page__alert" role="alert">{overviewError}</p>}
        {listError && <p className="form-message form-message--error expense-page__alert" role="alert">{listError}</p>}

        <section className="expense-panel" id="add-expense">
          <ExpenseForm
            categories={categoryOptions}
            onSubmit={handleSave}
            submitting={saving}
            title="Add a new expense"
          />
        </section>

        <section aria-labelledby="history-title" className="expense-panel expense-history">
          <div className="expense-history__heading">
            <div>
              <p className="eyebrow">YOUR TRANSACTIONS</p>
              <h2 id="history-title">Expense history</h2>
            </div>
            <span className="expense-history__count">{totalCount.toLocaleString('en-IN')} records</span>
          </div>

          <div className="expense-filters">
            <label className="expense-search">
              <Search aria-hidden="true" size={18} />
              <span className="sr-only">Search expenses</span>
              <input
                maxLength={100}
                onChange={(event) => updateFilter('search', event.target.value)}
                placeholder="Search name, description or notes"
                type="search"
                value={filters.search}
              />
              {filters.search && <button aria-label="Clear search" onClick={() => updateFilter('search', '')} type="button"><X size={16} /></button>}
            </label>
            <label className="expense-filter">
              <span>Date</span>
              <select onChange={(event) => updateFilter('datePreset', event.target.value)} value={filters.datePreset}>
                <option value="">All dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="lastMonth">Last month</option>
                <option value="year">This year</option>
                <option value="custom">Custom range</option>
              </select>
            </label>
            <label className="expense-filter">
              <span>Category</span>
              <select onChange={(event) => updateFilter('categoryId', event.target.value)} value={filters.categoryId}>
                <option value="">All categories</option>
                {categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
              </select>
            </label>
            <label className="expense-filter">
              <span>Payment</span>
              <select onChange={(event) => updateFilter('paymentMode', event.target.value)} value={filters.paymentMode}>
                <option value="">All methods</option>
                {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
              </select>
            </label>
            <label className="expense-filter">
              <span><ArrowDownUp aria-hidden="true" size={13} /> Sort</span>
              <select onChange={(event) => updateFilter('sort', event.target.value)} value={filters.sort}>
                <option value="latest">Latest first</option>
                <option value="oldest">Oldest first</option>
                <option value="highest">Highest amount</option>
                <option value="lowest">Lowest amount</option>
              </select>
            </label>
            <button className="expense-reset" onClick={resetFilters} type="button">Reset filters</button>
          </div>

          {filters.datePreset === 'custom' && (
            <div className="expense-custom-dates">
              <label className="expense-filter"><span>From</span><input onChange={(event) => updateFilter('startDate', event.target.value)} type="date" value={filters.startDate} /></label>
              <label className="expense-filter"><span>To</span><input onChange={(event) => updateFilter('endDate', event.target.value)} type="date" value={filters.endDate} /></label>
              {customRangeInvalid && <span className="form-message form-message--error" role="alert">Start date must be on or before end date.</span>}
            </div>
          )}

          <div aria-live="polite" className="expense-table-wrap">
            {loading ? (
              <div className="expense-state"><span className="loading-spinner" /><p>Loading your expenses…</p></div>
            ) : expenses.length === 0 ? (
              <div className="expense-state"><span className="expense-state__symbol">₹</span><h3>No expenses found</h3><p>{totalCount === 0 ? 'Add your first expense above and it will appear here.' : 'Try changing your search or filters.'}</p></div>
            ) : (
              <table className="expense-table">
                <thead><tr><th>Date</th><th>Expense</th><th>Category</th><th>Description</th><th>Payment</th><th>Amount</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td data-label="Date">{formatExpenseDate(expense.expense_date)}</td>
                      <td data-label="Expense"><strong>{expense.vendor}</strong></td>
                      <td data-label="Category">{categoryNames.get(expense.category_id) || 'Category unavailable'}</td>
                      <td data-label="Description">{expense.description || '—'}{expense.notes && <small className="expense-row-note">Note: {expense.notes}</small>}</td>
                      <td data-label="Payment"><span className="payment-pill">{expense.payment_mode}</span></td>
                      <td className="expense-amount" data-label="Amount">{formatRupees(expense.amount)}</td>
                      <td className="expense-actions" data-label="Actions">
                        <button aria-label={`Edit ${expense.vendor}`} onClick={() => setEditing(expense)} type="button"><Pencil size={16} /></button>
                        <button aria-label={`Delete ${expense.vendor}`} onClick={() => setDeleteTarget(expense)} type="button"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {totalCount > 0 && <div className="expense-pagination"><span>Page {page} of {pageCount}</span><div><button aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} type="button"><ChevronLeft size={18} /></button><button aria-label="Next page" disabled={page >= pageCount || loading} onClick={() => setPage((value) => value + 1)} type="button"><ChevronRight size={18} /></button></div></div>}
        </section>
      </main>

      {editing && (
        <div className="expense-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null) }}>
          <section aria-label="Edit expense" aria-modal="true" className="expense-modal" role="dialog">
            <button aria-label="Close edit form" className="expense-modal__close" onClick={() => setEditing(null)} type="button"><X size={19} /></button>
            <ExpenseForm
              categories={categoryOptions}
              initialValues={editInitialValues}
              key={editing.id}
              onCancel={() => setEditing(null)}
              onSubmit={handleSave}
              submitting={saving}
              title="Edit expense"
              titleId="edit-expense-title"
              submitLabel="Save changes"
            />
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="expense-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null) }}>
          <section aria-labelledby="delete-expense-title" aria-modal="true" className="expense-confirm" role="alertdialog">
            <button aria-label="Cancel deletion" className="expense-modal__close" onClick={() => setDeleteTarget(null)} type="button"><X size={19} /></button>
            <span className="expense-confirm__icon"><Trash2 size={20} /></span>
            <p className="eyebrow">REMOVE TRANSACTION</p>
            <h2 id="delete-expense-title">Delete this expense?</h2>
            <p><strong>{deleteTarget.vendor}</strong> · {formatRupees(deleteTarget.amount)} will be permanently removed.</p>
            <div className="expense-form__actions"><button className="button button--outline" disabled={deleting} onClick={() => setDeleteTarget(null)} type="button">Cancel</button><button className="button expense-delete-button" disabled={deleting} onClick={handleDelete} type="button">{deleting ? 'Deleting…' : 'Delete expense'}</button></div>
          </section>
        </div>
      )}

      {toast && <div className="expense-toast" role="status">{toast}</div>}
    </div>
  )
}

export default ExpensePage
