import { useEffect, useMemo, useState } from 'react'
import { ArrowDownUp, ChevronLeft, ChevronRight, PiggyBank, Plus, Search, Trash2, Pencil, X } from 'lucide-react'
import SavingForm from '../components/SavingForm.jsx'
import SavingsSummary from '../components/SavingsSummary.jsx'
import ExportActions from '../components/ExportActions.jsx'
import { useAuth } from '../context/useAuth.js'
import { getDateBounds } from '../lib/expenses.js'
import { formatExpenseDate, formatRupees } from '../lib/format.js'
import { getCategoryPath } from '../lib/categories.js'
import {
  deleteSaving,
  fetchSavingCategories,
  fetchSavingsPage,
  fetchSavingsSummary,
  PAYMENT_METHODS,
  SAVINGS_PAGE_SIZE,
  saveSaving,
} from '../lib/savings.js'
import { downloadSpreadsheet, fetchExportRows, makeExportFilename, SAVING_EXPORT_COLUMNS } from '../lib/exports.js'
import '../styles/expenses.css'
import '../styles/savings.css'

const initialFilters = {
  search: '',
  datePreset: '',
  startDate: '',
  endDate: '',
  categoryId: '',
  paymentMode: '',
  sort: 'latest',
}

function Savings() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [savings, setSavings] = useState([])
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
    () => categories.map((category) => ({ ...category, label: getCategoryPath(category, categories) })),
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
  const pageCount = Math.max(1, Math.ceil(totalCount / SAVINGS_PAGE_SIZE))

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
          fetchSavingCategories(user.id),
          fetchSavingsSummary(user.id),
        ])
        if (!active) return
        setCategories(categoryRows)
        setSummary(summaryData)
      } catch (error) {
        if (active) setOverviewError(error.message || 'Unable to load your savings overview.')
      } finally {
        if (active) setSummaryLoading(false)
      }
    }
    loadOverview()
    return () => { active = false }
  }, [refreshKey, user.id])

  useEffect(() => {
    let active = true
    async function loadSavingsPage() {
      setLoading(true)
      setListError('')
      if (customRangeInvalid) {
        setSavings([])
        setTotalCount(0)
        setLoading(false)
        return
      }
      try {
        const result = await fetchSavingsPage(user.id, appliedFilters, page)
        if (!active) return
        setSavings(result.savings)
        setTotalCount(result.count)
      } catch (error) {
        if (active) setListError(error.message || 'Unable to load savings. Check your connection and try again.')
      } finally {
        if (active) setLoading(false)
      }
    }
    loadSavingsPage()
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
      await saveSaving(user.id, values, editing?.id)
      const wasEditing = Boolean(editing?.id)
      setEditing(null)
      setPage(1)
      setRefreshKey((value) => value + 1)
      showToast(wasEditing ? 'Saving updated.' : 'Saving added.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await deleteSaving(user.id, deleteTarget.id)
      setDeleteTarget(null)
      if (savings.length === 1 && page > 1) setPage((value) => value - 1)
      setRefreshKey((value) => value + 1)
      showToast('Saving deleted.')
    } catch (error) {
      setListError(error.message || 'Unable to delete this saving.')
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
    source: editing.source ?? '',
    amount: String(editing.amount ?? ''),
    category_id: editing.category_id ?? '',
    saving_date: editing.saving_date ?? '',
    payment_mode: editing.payment_mode ?? '',
    description: editing.description ?? '',
    notes: editing.notes ?? '',
  } : null

  const categoryTotals = useMemo(() => {
    const totals = Object.entries(summary?.categoryTotals ?? {})
      .map(([categoryId, amount]) => ({ categoryId, amount, name: categoryNames.get(categoryId) || 'Category unavailable' }))
      .sort((left, right) => right.amount - left.amount)
    return totals
  }, [categoryNames, summary])

  return (
    <div className="app-shell">
      <main className="expense-page savings-page">
        <section className="expense-page__intro">
          <div><p className="eyebrow">BUILD YOUR FUTURE</p><h1>Savings</h1><p>Keep every deposit organized and see your progress over time.</p></div>
          <div className="expense-page__actions"><ExportActions onExport={async (format) => {
            if (customRangeInvalid) throw new Error('Choose a valid custom date range before exporting.')
            const rows = await fetchExportRows('saving', user.id, appliedFilters, categories)
            const bounds = getDateBounds(appliedFilters.datePreset, appliedFilters.startDate, appliedFilters.endDate)
            return downloadSpreadsheet({ rows, columns: SAVING_EXPORT_COLUMNS, filename: makeExportFilename('Savings', bounds), format })
          }} /><a className="button button--primary" href="#add-saving"><Plus aria-hidden="true" size={17} /> Add saving</a></div>
        </section>

        {overviewError && <p className="form-message form-message--error expense-page__alert" role="alert">{overviewError}</p>}
        {listError && <p className="form-message form-message--error expense-page__alert" role="alert">{listError}</p>}
        <SavingsSummary loading={summaryLoading || Boolean(overviewError)} summary={summary} />

        <section className="savings-breakdown expense-panel" aria-labelledby="saving-breakdown-title">
          <div className="expense-history__heading"><div><p className="eyebrow">WHERE IT’S GOING</p><h2 id="saving-breakdown-title">Savings by category</h2></div></div>
          {summaryLoading ? <p className="savings-breakdown__empty">Loading category totals…</p> : overviewError ? <p className="savings-breakdown__empty">Category totals are unavailable until the savings data can be loaded.</p> : categoryTotals.length === 0 ? <p className="savings-breakdown__empty">Category totals will appear after you add savings.</p> : (
            <div className="savings-breakdown__list">
              {categoryTotals.map((category) => <div className="savings-breakdown__row" key={category.categoryId}><span>{category.name}</span><strong>{formatRupees(category.amount)}</strong></div>)}
            </div>
          )}
        </section>

        <section className="expense-panel" id="add-saving"><SavingForm categories={categoryOptions} onSubmit={handleSave} submitting={saving} /></section>

        <section aria-labelledby="savings-history-title" className="expense-panel expense-history savings-history">
          <div className="expense-history__heading"><div><p className="eyebrow">YOUR DEPOSITS</p><h2 id="savings-history-title">Savings history</h2></div><span className="expense-history__count">{totalCount.toLocaleString('en-IN')} records</span></div>

          <div className="expense-filters savings-filters">
            <label className="expense-search"><Search aria-hidden="true" size={18} /><span className="sr-only">Search savings</span><input maxLength={100} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search source, description or notes" type="search" value={filters.search} />{filters.search && <button aria-label="Clear search" onClick={() => updateFilter('search', '')} type="button"><X size={16} /></button>}</label>
            <label className="expense-filter"><span>Date</span><select onChange={(event) => updateFilter('datePreset', event.target.value)} value={filters.datePreset}><option value="">All dates</option><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">This week</option><option value="month">This month</option><option value="lastMonth">Last month</option><option value="year">This year</option><option value="custom">Custom range</option></select></label>
            <label className="expense-filter"><span>Category</span><select onChange={(event) => updateFilter('categoryId', event.target.value)} value={filters.categoryId}><option value="">All saving categories</option>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
            <label className="expense-filter"><span>Payment</span><select onChange={(event) => updateFilter('paymentMode', event.target.value)} value={filters.paymentMode}><option value="">All methods</option>{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
            <label className="expense-filter"><span><ArrowDownUp aria-hidden="true" size={13} /> Sort</span><select onChange={(event) => updateFilter('sort', event.target.value)} value={filters.sort}><option value="latest">Latest first</option><option value="oldest">Oldest first</option><option value="highest">Highest amount</option><option value="lowest">Lowest amount</option></select></label>
            <button className="expense-reset" onClick={resetFilters} type="button">Reset filters</button>
          </div>

          {filters.datePreset === 'custom' && <div className="expense-custom-dates"><label className="expense-filter"><span>From</span><input onChange={(event) => updateFilter('startDate', event.target.value)} type="date" value={filters.startDate} /></label><label className="expense-filter"><span>To</span><input onChange={(event) => updateFilter('endDate', event.target.value)} type="date" value={filters.endDate} /></label>{customRangeInvalid && <span className="form-message form-message--error" role="alert">Start date must be on or before end date.</span>}</div>}

          <div aria-live="polite" className="expense-table-wrap">
            {loading ? <div className="expense-state"><span className="loading-spinner" /><p>Loading your savings…</p></div> : savings.length === 0 ? <div className="expense-state"><span className="expense-state__symbol"><PiggyBank size={19} /></span><h3>No savings found</h3><p>{totalCount === 0 ? 'Add your first saving above and it will appear here.' : 'Try changing your search or filters.'}</p></div> : (
              <table className="expense-table">
                <thead><tr><th>Date</th><th>Source</th><th>Category</th><th>Description</th><th>Payment</th><th>Amount</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>{savings.map((saving) => <tr key={saving.id}><td data-label="Date">{formatExpenseDate(saving.saving_date)}</td><td data-label="Source"><strong>{saving.source}</strong></td><td data-label="Category">{categoryNames.get(saving.category_id) || 'Category unavailable'}</td><td data-label="Description">{saving.description || '—'}{saving.notes && <small className="expense-row-note">Note: {saving.notes}</small>}</td><td data-label="Payment"><span className="payment-pill">{saving.payment_mode}</span></td><td className="expense-amount savings-amount" data-label="Amount">{formatRupees(saving.amount)}</td><td className="expense-actions" data-label="Actions"><button aria-label={`Edit ${saving.source}`} onClick={() => setEditing(saving)} type="button"><Pencil size={16} /></button><button aria-label={`Delete ${saving.source}`} onClick={() => setDeleteTarget(saving)} type="button"><Trash2 size={16} /></button></td></tr>)}</tbody>
              </table>
            )}
          </div>
          {totalCount > 0 && <div className="expense-pagination"><span>Page {page} of {pageCount}</span><div><button aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} type="button"><ChevronLeft size={18} /></button><button aria-label="Next page" disabled={page >= pageCount || loading} onClick={() => setPage((value) => value + 1)} type="button"><ChevronRight size={18} /></button></div></div>}
        </section>
      </main>

      {editing && <div className="expense-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditing(null) }}><section aria-label="Edit saving" aria-modal="true" className="expense-modal" role="dialog"><button aria-label="Close edit form" className="expense-modal__close" disabled={saving} onClick={() => setEditing(null)} type="button"><X size={19} /></button><SavingForm categories={categoryOptions} initialValues={editInitialValues} key={editing.id} onCancel={() => setEditing(null)} onSubmit={handleSave} submitting={saving} /></section></div>}

      {deleteTarget && <div className="expense-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteTarget(null) }}><section aria-labelledby="delete-saving-title" aria-modal="true" className="expense-confirm" role="alertdialog"><button aria-label="Cancel deletion" className="expense-modal__close" disabled={deleting} onClick={() => setDeleteTarget(null)} type="button"><X size={19} /></button><span className="expense-confirm__icon"><Trash2 size={20} /></span><p className="eyebrow">REMOVE SAVING</p><h2 id="delete-saving-title">Delete this saving?</h2><p><strong>{deleteTarget.source}</strong> · {formatRupees(deleteTarget.amount)} will be permanently removed.</p><div className="expense-form__actions"><button className="button button--outline" disabled={deleting} onClick={() => setDeleteTarget(null)} type="button">Cancel</button><button className="button expense-delete-button" disabled={deleting} onClick={handleDelete} type="button">{deleting ? 'Deleting…' : 'Delete saving'}</button></div></section></div>}
      {toast && <div className="expense-toast" role="status">{toast}</div>}
    </div>
  )
}

export default Savings
