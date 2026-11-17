import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Pencil, Plus, Trash2, WalletCards, X } from 'lucide-react'
import { useAuth } from '../context/useAuth.js'
import { fetchCategories, getCategoryPath, getDescendantCategoryIds } from '../lib/categories.js'
import { deleteBudget, fetchMonthBudgets, fetchMonthExpenses, getBudgetSpent, getBudgetStatus, monthInputToDate, saveBudget } from '../lib/budgets.js'
import { formatRupees } from '../lib/format.js'
import '../styles/expenses.css'
import '../styles/budgets.css'

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function readDismissedWarnings(userId, month) {
  try {
    const stored = JSON.parse(localStorage.getItem(`magpet-budget-warnings:${userId}:${month}`) || '[]')
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
}

function BudgetMetric({ label, value, note, status }) {
  return <article className={`budget-metric${status ? ` budget-metric--${status}` : ''}`}><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>
}

function Budgets() {
  const { user } = useAuth()
  const [month, setMonth] = useState(currentMonth)
  const [budgets, setBudgets] = useState([])
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [notice, setNotice] = useState('')
  const [budgetType, setBudgetType] = useState('overall')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [dismissedWarnings, setDismissedWarnings] = useState(() => readDismissedWarnings(user.id, currentMonth()))
  const [refreshKey, setRefreshKey] = useState(0)

  const monthStart = useMemo(() => {
    try { return monthInputToDate(month) } catch { return '' }
  }, [month])

  useEffect(() => {
    let active = true
    async function loadCategories() {
      setCategoryError('')
      try {
        const rows = await fetchCategories(user.id)
        if (active) setCategories(rows.filter((category) => category.transaction_type === 'expense'))
      } catch (loadError) {
        if (active) setCategoryError(loadError.message || 'Unable to load expense categories.')
      }
    }
    loadCategories()
    return () => { active = false }
  }, [user.id])

  useEffect(() => {
    let active = true
    async function loadBudgets() {
      setLoading(true)
      setError('')
      try {
        const [budgetRows, expenseRows] = await Promise.all([
          fetchMonthBudgets(user.id, monthStart),
          fetchMonthExpenses(user.id, monthStart),
        ])
        if (active) {
          setBudgets(budgetRows)
          setExpenses(expenseRows)
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.message || 'Unable to load budgets. Apply the included budgets migration if it has not been applied yet.')
          setBudgets([])
          setExpenses([])
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    if (monthStart) loadBudgets()
    return () => { active = false }
  }, [user.id, monthStart, refreshKey])

  const categoryNames = useMemo(() => new Map(categories.map((category) => [category.id, getCategoryPath(category, categories)])), [categories])
  const budgetRows = useMemo(() => budgets.map((budget) => {
    const spent = getBudgetSpent(budget, expenses, categories, getDescendantCategoryIds)
    return { ...budget, spent, ...getBudgetStatus(Number(budget.amount), spent) }
  }), [budgets, expenses, categories])
  const overallBudget = budgetRows.find((budget) => budget.budget_type === 'overall')
  const categoryBudgets = budgetRows.filter((budget) => budget.budget_type === 'category')
  const totalSpent = expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0)
  const configuredBudget = overallBudget?.amount ?? categoryBudgets.reduce((sum, budget) => sum + Number(budget.amount), 0)
  const summaryRemaining = overallBudget
    ? overallBudget.remaining
    : categoryBudgets.reduce((sum, budget) => sum + budget.remaining, 0)
  const exceededCount = budgetRows.filter((budget) => budget.status === 'exceeded').length
  const warningRows = budgetRows.filter((budget) => budget.status !== 'normal')
  const duplicateBudget = budgets.some((budget) => budget.id !== editing?.id && budget.budget_type === budgetType && (budgetType === 'overall' || budget.category_id === categoryId))

  function dismissWarning(budget, status) {
    const warningKey = `${budget.id}:${status}`
    const next = [...new Set([...dismissedWarnings, warningKey])]
    setDismissedWarnings(next)
    try {
      localStorage.setItem(`magpet-budget-warnings:${user.id}:${month}`, JSON.stringify(next))
    } catch {
      // Dismissal still applies for the current render if browser storage is unavailable.
    }
  }

  function resetForm() {
    setBudgetType('overall')
    setCategoryId('')
    setAmount('')
    setEditing(null)
  }

  function beginEdit(budget) {
    setEditing(budget)
    setBudgetType(budget.budget_type)
    setCategoryId(budget.category_id || '')
    setAmount(String(budget.amount))
    setNotice('')
    setError('')
  }

  async function handleSave(event) {
    event.preventDefault()
    if (saving || duplicateBudget) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await saveBudget(user.id, { budgetType, categoryId, budgetMonth: month, amount }, editing?.id)
      resetForm()
      setNotice('Budget saved for the selected month.')
      setLoading(true)
      setRefreshKey((value) => value + 1)
    } catch (saveError) {
      setError(saveError.message || 'Unable to save this budget.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    setError('')
    setNotice('')
    try {
      await deleteBudget(user.id, deleteTarget.id)
      setNotice('Budget deleted.')
      setDeleteTarget(null)
      setLoading(true)
      setRefreshKey((value) => value + 1)
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete this budget.')
    } finally {
      setDeleting(false)
    }
  }

  function renderProgress(budget) {
    const width = Math.min(100, Math.max(0, budget.percentage))
    const remainingLabel = budget.remaining < 0
      ? `Exceeded by ${formatRupees(Math.abs(budget.remaining))}`
      : budget.remaining === 0 ? 'Budget fully used' : `${formatRupees(budget.remaining)} remaining`
    const statusLabel = budget.status === 'exceeded' ? 'Exceeded' : budget.status === 'warning' ? '80%+ used' : 'On track'
    return <div className={`budget-progress budget-progress--${budget.status}`}>
      <div className="budget-progress__top"><span>{formatRupees(budget.spent)} spent of {formatRupees(budget.amount)}</span><strong>{budget.percentage.toFixed(1)}%</strong></div>
      <div aria-label={`${budget.percentage.toFixed(0)} percent of budget used`} className="budget-progress__track" role="progressbar" aria-valuenow={Math.min(100, Math.round(budget.percentage))} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${width}%` }} /></div>
      <div className="budget-progress__bottom"><span>{remainingLabel}</span><span>{statusLabel}</span></div>
    </div>
  }

  return (
    <div className="app-shell budgets-shell">
      <main className="expense-page budgets-page">
        <section className="expense-page__intro budgets-intro"><div><p className="eyebrow">PLAN YOUR SPENDING</p><h1>Budgets</h1><p>Set monthly limits and keep spending on track.</p></div><label className="budget-month-picker"><span>Budget month</span><input aria-label="Budget month" onChange={(event) => { const nextMonth = event.target.value; if (nextMonth) { setLoading(true); setMonth(nextMonth); setDismissedWarnings(readDismissedWarnings(user.id, nextMonth)); resetForm(); setNotice('') } }} type="month" value={month} /></label></section>

        {error && <p className="form-message form-message--error expense-page__alert" role="alert">{error}</p>}
        {categoryError && <p className="form-message form-message--error expense-page__alert" role="alert">{categoryError}</p>}
        {notice && <p className="form-message form-message--success expense-page__alert" role="status">{notice}</p>}

        {!loading && warningRows.length > 0 && <section aria-label="Budget warnings" className="budget-warnings">{warningRows.map((budget) => {
          const messageKey = `${budget.id}:${budget.status}`
          if (dismissedWarnings.includes(messageKey)) return null
          const budgetName = budget.budget_type === 'overall' ? 'Overall monthly budget' : categoryNames.get(budget.category_id) || 'Category budget'
          const message = budget.status === 'exceeded'
            ? `${budgetName} exceeded by ${formatRupees(Math.max(0, budget.spent - Number(budget.amount)))}.`
            : `${budgetName} has reached ${budget.percentage.toFixed(0)}% of its limit.`
          return <div className={`budget-warning budget-warning--${budget.status}`} key={budget.id}><AlertTriangle size={17} /><span>{message}</span><button aria-label={`Dismiss warning for ${budgetName}`} onClick={() => dismissWarning(budget, budget.status)} type="button"><X size={16} /></button></div>
        })}</section>}

        <section aria-label="Budget overview" className="budget-overview">
          <BudgetMetric label="Monthly budget" value={loading ? '—' : formatRupees(configuredBudget)} note={overallBudget ? 'Overall limit' : 'Combined category limits'} />
          <BudgetMetric label="Amount spent" value={loading ? '—' : formatRupees(totalSpent)} note="Expense records only" />
          <BudgetMetric label={summaryRemaining < 0 ? 'Over overall budget' : 'Remaining budget'} value={loading ? '—' : `${summaryRemaining < 0 ? '−' : ''}${formatRupees(Math.abs(summaryRemaining))}`} note={overallBudget ? 'Overall budget' : 'Across category limits'} status={summaryRemaining < 0 ? 'exceeded' : undefined} />
          <BudgetMetric label="Exceeded budgets" value={loading ? '—' : exceededCount.toLocaleString('en-IN')} note="Overall and category limits" status={exceededCount ? 'exceeded' : undefined} />
        </section>

        <section aria-labelledby="budget-form-title" className="expense-panel budget-form-panel">
          <div className="expense-history__heading"><div><p className="eyebrow">MONTHLY LIMITS</p><h2 id="budget-form-title">{editing ? 'Edit budget' : 'Add a budget'}</h2></div><span className="budget-form-panel__month">{new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(`${monthStart}T00:00:00`))}</span></div>
          <form className="budget-form" onSubmit={handleSave}>
            <label><span>Budget type</span><select disabled={Boolean(editing)} onChange={(event) => { setBudgetType(event.target.value); setCategoryId('') }} value={budgetType}><option value="overall">Overall monthly budget</option><option value="category">Category budget</option></select></label>
            {budgetType === 'category' && <label><span>Expense category</span><select onChange={(event) => setCategoryId(event.target.value)} required value={categoryId}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{categoryNames.get(category.id)}</option>)}</select></label>}
            <label><span>Monthly limit (₹)</span><input min="0.01" onChange={(event) => setAmount(event.target.value)} required step="0.01" type="number" value={amount} /></label>
            <div className="budget-form__actions"><button className="button button--primary" disabled={loading || saving || duplicateBudget} type="submit"><Plus size={16} />{saving ? 'Saving…' : editing ? 'Save changes' : 'Save budget'}</button>{editing && <button className="button button--outline" disabled={saving} onClick={resetForm} type="button">Cancel</button>}{duplicateBudget && <span className="budget-inline-note">A budget already exists for this selection.</span>}</div>
          </form>
        </section>

        <section aria-labelledby="budget-progress-title" className="expense-panel budget-list-panel">
          <div className="expense-history__heading"><div><p className="eyebrow">SPENDING PROGRESS</p><h2 id="budget-progress-title">Budgets for this month</h2></div><span className="expense-history__count">{budgetRows.length} limits</span></div>
          {loading ? <div className="expense-state"><span className="loading-spinner" /><p>Loading budgets and expenses…</p></div> : budgetRows.length === 0 ? <div className="expense-state"><span className="expense-state__symbol"><WalletCards size={19} /></span><h3>No budgets for this month</h3><p>Create an overall or category budget to start tracking your spending.</p></div> : <div className="budget-list">{budgetRows.map((budget) => {
            const title = budget.budget_type === 'overall' ? 'Overall monthly budget' : categoryNames.get(budget.category_id) || 'Expense category unavailable'
            return <article className={`budget-item budget-item--${budget.status}`} key={budget.id}>
              <div className="budget-item__heading"><div><span className="budget-item__type">{budget.budget_type === 'overall' ? 'OVERALL' : 'CATEGORY'}</span><h3>{title}</h3></div><div className="budget-item__actions"><button aria-label={`Edit ${title}`} onClick={() => beginEdit(budget)} type="button"><Pencil size={16} /></button><button aria-label={`Delete ${title}`} onClick={() => setDeleteTarget(budget)} type="button"><Trash2 size={16} /></button></div></div>
              {renderProgress(budget)}
            </article>
          })}</div>}
        </section>

        {deleteTarget && <div className="budget-delete-confirm" role="alertdialog" aria-modal="true" aria-labelledby="budget-delete-title"><div><h2 id="budget-delete-title">Delete this budget?</h2><p>{deleteTarget.budget_type === 'overall' ? 'Overall monthly budget' : categoryNames.get(deleteTarget.category_id) || 'Category budget'} for {month} will be removed. Expense and category records are not affected.</p><div><button className="button button--outline" disabled={deleting} onClick={() => setDeleteTarget(null)} type="button">Keep budget</button><button className="button budget-delete-confirm__action" disabled={deleting} onClick={handleDelete} type="button">{deleting ? 'Deleting…' : 'Delete budget'}</button></div></div></div>}
      </main>
    </div>
  )
}

export default Budgets
