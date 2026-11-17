import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, CircleHelp, ReceiptText, TrendingUp } from 'lucide-react'
import { Link, useOutletContext } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart, CartesianGrid } from 'recharts'
import { useAuth } from '../context/useAuth.js'
import { fetchDashboardExpenses, fetchExpenseCategories, fetchExpenseSummary, fetchRecentExpenses, getCategoryLabel, getDateBounds } from '../lib/expenses.js'
import { fetchRecentSavings, fetchSavingCategories } from '../lib/savings.js'
import { formatExpenseDate, formatRupees } from '../lib/format.js'
import '../styles/expenses.css'
import '../styles/dashboard.css'

const COLORS = ['#00d5f2', '#087cff', '#00bfcb', '#8b78ff', '#ffad5c', '#f16ca6', '#61cf8c', '#aab8c8']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
]

function localDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function Dashboard() {
  const { user } = useAuth()
  const { profileName = '' } = useOutletContext()
  const [today] = useState(() => new Date())
  const [summary, setSummary] = useState(null)
  const [categories, setCategories] = useState([])
  const [savingCategories, setSavingCategories] = useState([])
  const [recentTransactions, setRecentTransactions] = useState([])
  const [periodExpenses, setPeriodExpenses] = useState([])
  const [yearExpenses, setYearExpenses] = useState([])
  const [period, setPeriod] = useState('month')
  const [startDate, setStartDate] = useState(() => localDateString(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [endDate, setEndDate] = useState(() => localDateString(today))
  const [chartYear, setChartYear] = useState(() => today.getFullYear())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [categoryLoading, setCategoryLoading] = useState(true)
  const [monthlyLoading, setMonthlyLoading] = useState(true)
  const [categoryError, setCategoryError] = useState('')
  const [monthlyError, setMonthlyError] = useState('')
  const name = profileName || user?.user_metadata?.full_name?.trim() || user?.user_metadata?.username?.trim() || user?.email?.split('@')[0] || 'there'

  useEffect(() => {
    let active = true
    async function loadDashboard() {
      setLoading(true)
      setError('')
      try {
        const [summaryData, expenseRows, expenseCategoryRows, savingRows, savingCategoryRows] = await Promise.all([
          fetchExpenseSummary(user.id),
          fetchRecentExpenses(user.id, 10),
          fetchExpenseCategories(user.id),
          fetchRecentSavings(user.id, 10),
          fetchSavingCategories(user.id),
        ])
        if (!active) return
        setSummary(summaryData)
        setCategories(expenseCategoryRows)
        setSavingCategories(savingCategoryRows)
        const transactions = [
          ...expenseRows.map((row) => ({ ...row, kind: 'expense', date: row.expense_date, title: row.vendor || row.description || 'Expense' })),
          ...savingRows.map((row) => ({ ...row, kind: 'saving', date: row.saving_date, title: row.source || row.description || 'Saving' })),
        ].sort((a, b) => b.date.localeCompare(a.date) || (b.created_at || '').localeCompare(a.created_at || '') || b.id.localeCompare(a.id)).slice(0, 8)
        setRecentTransactions(transactions)
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load your financial overview.')
      } finally {
        if (active) setLoading(false)
      }
    }
    loadDashboard()
    return () => { active = false }
  }, [user.id])

  useEffect(() => {
    let active = true
    async function loadCategoryAnalytics() {
      setCategoryLoading(true)
      setCategoryError('')
      try {
        if (period === 'custom' && (!startDate || !endDate || startDate > endDate)) {
          setPeriodExpenses([])
          setCategoryError('Choose a valid date range to view analytics.')
          return
        }
        const bounds = getDateBounds(period, startDate, endDate)
        const selectedExpenses = await fetchDashboardExpenses(user.id, bounds.from, bounds.to)
        if (active) setPeriodExpenses(selectedExpenses)
      } catch (loadError) {
        if (active) setCategoryError(loadError.message || 'Unable to load category analytics.')
      } finally {
        if (active) setCategoryLoading(false)
      }
    }
    loadCategoryAnalytics()
    return () => { active = false }
  }, [user.id, period, startDate, endDate])

  useEffect(() => {
    let active = true
    async function loadMonthlyAnalytics() {
      setMonthlyLoading(true)
      setMonthlyError('')
      try {
        const yearRows = await fetchDashboardExpenses(user.id, `${chartYear}-01-01`, `${chartYear}-12-31`)
        if (active) setYearExpenses(yearRows)
      } catch (loadError) {
        if (active) setMonthlyError(loadError.message || 'Unable to load monthly analytics.')
      } finally {
        if (active) setMonthlyLoading(false)
      }
    }
    loadMonthlyAnalytics()
    return () => { active = false }
  }, [user.id, chartYear])

  const categoryData = useMemo(() => {
    const byCategory = new Map()
    for (const expense of periodExpenses) {
      const amountCents = Math.round((Number(expense.amount) || 0) * 100)
      if (amountCents <= 0) continue
      const category = categories.find((item) => item.id === expense.category_id)
      const label = category ? getCategoryLabel(category, categories) : 'Uncategorized'
      byCategory.set(label, (byCategory.get(label) || 0) + amountCents)
    }
    return [...byCategory.entries()].map(([name, amount]) => ({ name, amount: amount / 100 }))
      .sort((a, b) => b.amount - a.amount)
  }, [periodExpenses, categories])

  const monthlyData = useMemo(() => MONTHS.map((month, index) => ({
    month,
    amount: yearExpenses.reduce((total, expense) => {
      const expenseMonth = Number(expense.expense_date?.slice(5, 7)) - 1
      return expenseMonth === index ? total + Math.round((Number(expense.amount) || 0) * 100) : total
    }, 0),
  })).map(({ month, amount }) => ({ month, amount: amount / 100 })), [yearExpenses])

  const periodTotal = useMemo(() => periodExpenses.reduce((sum, expense) => sum + Math.round((Number(expense.amount) || 0) * 100), 0) / 100, [periodExpenses])
  const periodLabel = PERIODS.find((item) => item.value === period)?.label || 'Selected period'

  return (
    <div className="app-shell dashboard-shell">
      <main className="expense-page dashboard-page">
        <section className="dashboard-welcome">
          <div>
            <p className="eyebrow">YOUR MAGPET SPACE</p>
            <h1>Welcome back, {name.split(/[\s@._-]+/)[0]}</h1>
            <p>Here is your financial overview.</p>
          </div>
          <div className="dashboard-welcome__date"><CalendarDays aria-hidden="true" size={17} />{new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(today)}</div>
        </section>

        {error && <p className="form-message form-message--error expense-page__alert" role="alert">{error}</p>}

        <section aria-label="Expense totals" className="dashboard-metrics">
          <article className="dashboard-metric"><span className="dashboard-metric__icon"><ReceiptText size={19} /></span><div><p>Total expenses</p><strong aria-label={loading ? 'Loading total expenses' : undefined} className={loading ? 'dashboard-skeleton' : undefined}>{loading ? '' : formatRupees(summary?.all)}</strong><small>{loading ? 'Loading records' : `${summary?.count || 0} recorded transactions`}</small></div></article>
          <article className="dashboard-metric dashboard-metric--cyan"><span className="dashboard-metric__icon"><ArrowDownRight size={19} /></span><div><p>Today’s spending</p><strong aria-label={loading ? 'Loading today’s spending' : undefined} className={loading ? 'dashboard-skeleton' : undefined}>{loading ? '' : formatRupees(summary?.today)}</strong><small>Based on expense date</small></div></article>
          <article className="dashboard-metric dashboard-metric--blue"><span className="dashboard-metric__icon"><TrendingUp size={19} /></span><div><p>Monthly spending</p><strong aria-label={loading ? 'Loading monthly spending' : undefined} className={loading ? 'dashboard-skeleton' : undefined}>{loading ? '' : formatRupees(summary?.month)}</strong><small>Current calendar month</small></div></article>
          <article className="dashboard-metric dashboard-metric--violet"><span className="dashboard-metric__icon"><ArrowUpRight size={19} /></span><div><p>Yearly spending</p><strong aria-label={loading ? 'Loading yearly spending' : undefined} className={loading ? 'dashboard-skeleton' : undefined}>{loading ? '' : formatRupees(summary?.year)}</strong><small>Current calendar year</small></div></article>
        </section>

        <section aria-labelledby="analytics-heading" className="dashboard-section">
          <div className="dashboard-section__heading">
            <div><p className="eyebrow">SPENDING ANALYTICS</p><h2 id="analytics-heading">Understand your expenses</h2></div>
            <label className="dashboard-filter"><span>Expense period</span><select onChange={(event) => setPeriod(event.target.value)} value={period}>{PERIODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          </div>
          {period === 'custom' && <div className="dashboard-date-range"><label><span>From</span><input max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} /></label><label><span>To</span><input min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} /></label></div>}
          <div className="dashboard-chart-grid">
            <section aria-labelledby="category-chart-heading" className="dashboard-panel">
              <div className="dashboard-panel__heading"><div><h3 id="category-chart-heading">Spending by category</h3><p>{periodLabel} · {formatRupees(periodTotal)} total</p></div><CircleHelp aria-label="Expense categories for the selected period" size={17} /></div>
              {categoryError ? <p className="dashboard-chart-state dashboard-chart-state--error" role="alert">{categoryError}</p> : categoryLoading ? <div className="dashboard-chart-state"><span className="loading-spinner" /><span>Loading category data…</span></div> : categoryData.length === 0 ? <div className="dashboard-chart-state"><span>No expenses in this period</span><Link className="text-link" to="/expenses">Add an expense <ArrowRight size={14} /></Link></div> : (
                <div className="dashboard-donut-layout">
                  <div className="dashboard-donut"><ResponsiveContainer height="100%" width="100%"><PieChart><Pie data={categoryData} dataKey="amount" nameKey="name" innerRadius="63%" outerRadius="88%" paddingAngle={3} stroke="none">{categoryData.map((entry, index) => <Cell fill={COLORS[index % COLORS.length]} key={entry.name} />)}</Pie><Tooltip formatter={(value) => formatRupees(value)} contentStyle={{ background: '#101b29', border: '1px solid rgba(163,186,212,.2)', borderRadius: 9, color: '#fff' }} /></PieChart></ResponsiveContainer><div className="dashboard-donut__total"><strong>{formatRupees(periodTotal)}</strong><span>{periodLabel}</span></div></div>
                  <ul className="dashboard-legend">{categoryData.map((entry, index) => <li key={entry.name}><span className="dashboard-legend__swatch" style={{ background: COLORS[index % COLORS.length] }} /><span className="dashboard-legend__name">{entry.name}</span><span className="dashboard-legend__value">{formatRupees(entry.amount)}</span><small>{periodTotal ? `${((entry.amount / periodTotal) * 100).toFixed(1)}%` : '0%'}</small></li>)}</ul>
                </div>
              )}
            </section>

            <section aria-labelledby="monthly-chart-heading" className="dashboard-panel">
              <div className="dashboard-panel__heading"><div><h3 id="monthly-chart-heading">Monthly spending</h3><p>Expense totals across {chartYear}</p></div><label className="dashboard-year"><span className="sr-only">Chart year</span><select aria-label="Select chart year" onChange={(event) => setChartYear(Number(event.target.value))} value={chartYear}>{Array.from({ length: 8 }, (_, index) => today.getFullYear() - index).map((year) => <option key={year} value={year}>{year}</option>)}</select></label></div>
              {monthlyError ? <p className="dashboard-chart-state dashboard-chart-state--error" role="alert">{monthlyError}</p> : monthlyLoading ? <div className="dashboard-chart-state"><span className="loading-spinner" /><span>Loading monthly totals…</span></div> : <div className="dashboard-bars"><ResponsiveContainer height="100%" width="100%"><BarChart data={monthlyData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}><CartesianGrid stroke="rgba(163,186,212,.1)" vertical={false} /><XAxis axisLine={false} tickLine={false} dataKey="month" tick={{ fill: '#aab8c8', fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} width={54} domain={[0, (dataMax) => Math.max(dataMax, 1000)]} tick={{ fill: '#748397', fontSize: 10 }} tickFormatter={(value) => value >= 1000 ? `₹${Math.round(value / 1000)}k` : `₹${value}`} /><Tooltip formatter={(value) => formatRupees(value)} labelFormatter={(label) => `${label} ${chartYear}`} contentStyle={{ background: '#101b29', border: '1px solid rgba(163,186,212,.2)', borderRadius: 9, color: '#fff' }} /><Bar dataKey="amount" fill="#00c4df" radius={[5, 5, 0, 0]} maxBarSize={35} /></BarChart></ResponsiveContainer></div>}
            </section>
          </div>
        </section>

        <section aria-labelledby="recent-transactions-heading" className="dashboard-panel dashboard-transactions">
          <div className="dashboard-panel__heading"><div><p className="eyebrow">LATEST ACTIVITY</p><h2 id="recent-transactions-heading">Recent transactions</h2></div><div className="dashboard-transaction-links"><Link className="text-link" to="/expenses">All expenses <ArrowRight size={14} /></Link><Link className="text-link" to="/savings">All savings <ArrowRight size={14} /></Link></div></div>
          {loading ? <div className="dashboard-chart-state"><span className="loading-spinner" /><span>Loading your latest transactions…</span></div> : recentTransactions.length === 0 ? <div className="dashboard-chart-state"><span>No transactions yet</span><span><Link className="text-link" to="/expenses">Add an expense</Link> or <Link className="text-link" to="/savings">add savings</Link>.</span></div> : (
            <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Date</th><th>Transaction</th><th>Category</th><th>Type</th><th>Payment method</th><th className="dashboard-table__amount">Amount</th></tr></thead><tbody>{recentTransactions.map((transaction) => {
              const list = transaction.kind === 'expense' ? categories : savingCategories
              const category = list.find((item) => item.id === transaction.category_id)
              const categoryLabel = category ? getCategoryLabel(category, list) : 'Uncategorized'
              return <tr key={`${transaction.kind}-${transaction.id}`}><td>{formatExpenseDate(transaction.date)}</td><td><strong>{transaction.title}</strong></td><td>{categoryLabel}</td><td><span className={`transaction-type transaction-type--${transaction.kind}`}>{transaction.kind === 'expense' ? 'Expense' : 'Saving'}</span></td><td>{transaction.payment_mode || '—'}</td><td className={`dashboard-table__amount ${transaction.kind === 'saving' ? 'dashboard-table__amount--saving' : ''}`}>{transaction.kind === 'saving' ? '+' : '−'}{formatRupees(transaction.amount)}</td></tr>
            })}</tbody></table></div>
          )}
        </section>
      </main>
    </div>
  )
}

export default Dashboard
