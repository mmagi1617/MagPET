import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowRight, CalendarDays, ChartColumnIncreasing, ChevronLeft, ChevronRight, RotateCcw, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ExportActions from '../components/ExportActions.jsx'
import PdfExportButton from '../components/PdfExportButton.jsx'
import { useAuth } from '../context/useAuth.js'
import { fetchExpenseCategories, getCategoryLabel, PAYMENT_METHODS, toLocalDateString } from '../lib/expenses.js'
import { fetchSavingCategories } from '../lib/savings.js'
import { aggregateByCategory, aggregateByDate, aggregateByMonth, fetchReportTransactions, getReportTotals } from '../lib/reports.js'
import { downloadSpreadsheet, makeExportFilename, REPORT_EXPORT_COLUMNS } from '../lib/exports.js'
import { downloadReportPdf } from '../lib/pdf-reports.js'
import { formatExpenseDate, formatRupees } from '../lib/format.js'
import '../styles/expenses.css'
import '../styles/reports.css'

const REPORT_TABS = [
  { value: 'daily', label: 'Daily' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom range' },
]
const CHART_COLORS = ['#00d5f2', '#087cff', '#00bfcb', '#8b78ff', '#ffad5c', '#f16ca6', '#61cf8c', '#b5a4ff', '#aab8c8']
const MONTHS = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date(2024, index, 1)))
const YEARS = Array.from({ length: 12 }, (_, index) => new Date().getFullYear() - index)
const PAGE_SIZE = 10

function monthBounds(year, month) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return { from: toLocalDateString(start), to: toLocalDateString(end) }
}

function yearBounds(year) {
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

function dayShift(dateString, offset) {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day + offset)
  return toLocalDateString(date)
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return <div className="reports-tooltip"><strong>{label}</strong>{payload.map((item) => <span key={item.dataKey} style={{ color: item.color }}>{item.name || item.dataKey}: {formatRupees(item.value)}</span>)}</div>
}

function ReportStat({ label, value, note, kind }) {
  const loading = value === 'Loading…'
  return <article className={`reports-stat${kind ? ` reports-stat--${kind}` : ''}`}><div className="reports-stat__top"><span>{label}</span><span aria-hidden="true" className="reports-stat__icon">{kind === 'saving' ? <ArrowRight size={17} /> : kind === 'count' ? <ChartColumnIncreasing size={17} /> : <ArrowDownRight size={17} />}</span></div><strong aria-label={loading ? `Loading ${label.toLowerCase()}` : undefined} className={loading ? 'reports-skeleton' : undefined}>{loading ? '' : value}</strong>{note && <small>{note}</small>}</article>
}

function Reports() {
  const { user } = useAuth()
  const [reportType, setReportType] = useState('monthly')
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateString(new Date()))
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())
  const [startDraft, setStartDraft] = useState('')
  const [endDraft, setEndDraft] = useState('')
  const [customRange, setCustomRange] = useState(null)
  const [customError, setCustomError] = useState('')
  const [transactions, setTransactions] = useState({ expenses: [], savings: [] })
  const [expenseCategories, setExpenseCategories] = useState([])
  const [savingCategories, setSavingCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('latest')
  const [categorySort, setCategorySort] = useState('highest')
  const [page, setPage] = useState(1)

  const bounds = useMemo(() => {
    if (reportType === 'daily') return { from: selectedDate, to: selectedDate }
    if (reportType === 'monthly') return monthBounds(selectedYear, selectedMonth)
    if (reportType === 'yearly') return yearBounds(selectedYear)
    return customRange
  }, [reportType, selectedDate, selectedMonth, selectedYear, customRange])

  useEffect(() => {
    let active = true
    async function loadCategories() {
      try {
        const [expenses, savings] = await Promise.all([
          fetchExpenseCategories(user.id),
          fetchSavingCategories(user.id),
        ])
        if (active) {
          setExpenseCategories(expenses)
          setSavingCategories(savings)
        }
      } catch (loadError) {
        if (active) setCategoryError(loadError.message || 'Unable to load report categories.')
      }
    }
    loadCategories()
    return () => { active = false }
  }, [user.id])

  useEffect(() => {
    let active = true
    async function loadTransactions() {
      if (reportType === 'custom' && !customRange) {
        setTransactions({ expenses: [], savings: [] })
        setLoading(false)
        setError('')
        return
      }
      setLoading(true)
      setError('')
      try {
        const data = await fetchReportTransactions(user.id, bounds?.from, bounds?.to)
        if (active) setTransactions(data)
      } catch (loadError) {
        if (active) {
          setTransactions({ expenses: [], savings: [] })
          setError(loadError.message || 'Unable to load this report. Please try again.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadTransactions()
    return () => { active = false }
  }, [user.id, reportType, bounds, customRange])

  const categories = useMemo(() => [...expenseCategories, ...savingCategories], [expenseCategories, savingCategories])
  const allTransactions = useMemo(() => [...transactions.expenses, ...transactions.savings], [transactions])
  const filteredTransactions = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return allTransactions.filter((transaction) => {
      if (typeFilter !== 'all' && transaction.type !== typeFilter) return false
      if (categoryFilter && transaction.category_id !== categoryFilter) return false
      if (paymentFilter && transaction.payment_mode !== paymentFilter) return false
      if (needle && ![transaction.name, transaction.description, transaction.notes].some((value) => value?.toLowerCase().includes(needle))) return false
      return true
    }).sort((left, right) => {
      if (sortOrder === 'oldest') return left.transactionDate.localeCompare(right.transactionDate) || left.id.localeCompare(right.id)
      if (sortOrder === 'highest') return Number(right.amount) - Number(left.amount) || right.transactionDate.localeCompare(left.transactionDate)
      if (sortOrder === 'lowest') return Number(left.amount) - Number(right.amount) || right.transactionDate.localeCompare(left.transactionDate)
      return right.transactionDate.localeCompare(left.transactionDate) || (right.created_at || '').localeCompare(left.created_at || '') || right.id.localeCompare(left.id)
    })
  }, [allTransactions, typeFilter, categoryFilter, paymentFilter, search, sortOrder])

  const totals = useMemo(() => getReportTotals(filteredTransactions), [filteredTransactions])
  const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE))
  const visibleTransactions = filteredTransactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const reportExpenseRows = filteredTransactions.filter((item) => item.type === 'expense')
  const reportSavingRows = filteredTransactions.filter((item) => item.type === 'saving')
  const categoryRows = useMemo(() => {
    const rows = aggregateByCategory(reportExpenseRows, expenseCategories).map((row) => ({
      ...row,
      label: row.category ? getCategoryLabel(row.category, expenseCategories) : 'Uncategorized',
    }))
    return rows.sort((a, b) => categorySort === 'highest' ? b.amount - a.amount : a.amount - b.amount)
  }, [reportExpenseRows, expenseCategories, categorySort])

  const dateRangeCount = useMemo(() => {
    if (!bounds) return []
    const [year, month] = bounds.from.split('-').map(Number)
    return reportType === 'daily' ? 1 : reportType === 'monthly' ? daysInMonth(year, month) : Math.round((new Date(`${bounds.to}T00:00:00`) - new Date(`${bounds.from}T00:00:00`)) / 86400000) + 1
  }, [bounds, reportType])

  const expenseDailyTrend = useMemo(() => bounds && reportType !== 'yearly'
    ? aggregateByDate(filteredTransactions.filter((item) => item.type === 'expense'), dateRangeCount, bounds.from)
      .map((entry) => ({ ...entry, label: formatExpenseDate(entry.date).replace(/\s\d{4}$/, '') }))
    : [], [filteredTransactions, reportType, bounds, dateRangeCount])
  const savingsDailyTrend = useMemo(() => bounds && reportType !== 'yearly'
    ? aggregateByDate(filteredTransactions.filter((item) => item.type === 'saving'), dateRangeCount, bounds.from)
      .map((entry) => ({ ...entry, label: formatExpenseDate(entry.date).replace(/\s\d{4}$/, '') }))
    : [], [filteredTransactions, reportType, bounds, dateRangeCount])
  const monthlyExpenseTrend = useMemo(() => reportType === 'yearly'
    ? aggregateByMonth(filteredTransactions, selectedYear, 'expense')
    : expenseDailyTrend, [filteredTransactions, reportType, selectedYear, expenseDailyTrend])
  const monthlySavingTrend = useMemo(() => reportType === 'yearly'
    ? aggregateByMonth(filteredTransactions, selectedYear, 'saving')
    : savingsDailyTrend, [filteredTransactions, reportType, selectedYear, savingsDailyTrend])

  const trendData = useMemo(() => {
    if (reportType === 'yearly') {
      const expenses = aggregateByMonth(filteredTransactions, selectedYear, 'expense')
      const savings = aggregateByMonth(filteredTransactions, selectedYear, 'saving')
      return expenses.map((expense, index) => ({ label: expense.label, expenses: expense.amount, savings: savings[index].amount }))
    }
    return expenseDailyTrend.map((day, index) => ({ label: day.label, expenses: day.amount, savings: savingsDailyTrend[index]?.amount || 0 }))
  }, [filteredTransactions, reportType, selectedYear, expenseDailyTrend, savingsDailyTrend])

  const paymentBreakdown = useMemo(() => PAYMENT_METHODS.map((method) => ({
    method,
    expenses: reportExpenseRows.filter((row) => row.payment_mode === method).reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0) / 100,
    savings: reportSavingRows.filter((row) => row.payment_mode === method).reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0) / 100,
  })).filter((row) => row.expenses || row.savings), [reportExpenseRows, reportSavingRows])

  const yearlyStats = useMemo(() => {
    const expenseMonths = aggregateByMonth(filteredTransactions, selectedYear, 'expense')
    const savingMonths = aggregateByMonth(filteredTransactions, selectedYear, 'saving')
    const highestExpense = [...expenseMonths].sort((a, b) => b.amount - a.amount)[0]
    const lowestExpense = [...expenseMonths].sort((a, b) => a.amount - b.amount)[0]
    const highestSaving = [...savingMonths].sort((a, b) => b.amount - a.amount)[0]
    return {
      averageExpense: expenseMonths.reduce((sum, month) => sum + Math.round(month.amount * 100), 0) / 1200,
      averageSaving: savingMonths.reduce((sum, month) => sum + Math.round(month.amount * 100), 0) / 1200,
      highestExpense: highestExpense?.amount ? `${highestExpense.label} · ${formatRupees(highestExpense.amount)}` : '—',
      lowestExpense: expenseMonths.some((month) => month.amount > 0) && lowestExpense ? `${lowestExpense.label} · ${formatRupees(lowestExpense.amount)}` : '—',
      highestSaving: highestSaving?.amount ? `${highestSaving.label} · ${formatRupees(highestSaving.amount)}` : '—',
    }
  }, [filteredTransactions, selectedYear])

  function resetFilters() {
    setSearch('')
    setCategoryFilter('')
    setPaymentFilter('')
    setTypeFilter('all')
    setSortOrder('latest')
    setCategorySort('highest')
    setPage(1)
  }

  function selectReportType(type) {
    setReportType(type)
    setPage(1)
    if (type !== 'custom') setCustomError('')
  }

  function generateCustomReport() {
    setCustomError('')
    if (!startDraft || !endDraft) {
      setCustomRange(null)
      return setCustomError('Choose both a start date and an end date.')
    }
    if (startDraft > endDraft) {
      setCustomRange(null)
      return setCustomError('Start date must be on or before the end date.')
    }
    setCustomRange({ from: startDraft, to: endDraft })
    setPage(1)
  }

  function resetCustomRange() {
    setStartDraft('')
    setEndDraft('')
    setCustomRange(null)
    setCustomError('')
    setTransactions({ expenses: [], savings: [] })
    setPage(1)
  }

  const headingRange = bounds ? (bounds.from === bounds.to ? formatExpenseDate(bounds.from) : `${formatExpenseDate(bounds.from)} – ${formatExpenseDate(bounds.to)}`) : 'Choose a date range'
  const statNote = reportType === 'daily' ? 'Selected date' : reportType === 'monthly' ? `${MONTHS[selectedMonth - 1]} ${selectedYear}` : reportType === 'yearly' ? `Calendar year ${selectedYear}` : 'Selected custom range'
  const reportTitle = `${reportType[0].toUpperCase()}${reportType.slice(1)} report`

  async function exportReport(format) {
    const rows = filteredTransactions.map((transaction) => {
      const categoryList = transaction.type === 'expense' ? expenseCategories : savingCategories
      const category = categoryList.find((item) => item.id === transaction.category_id)
      return {
        date: formatExpenseDate(transaction.transactionDate),
        name: transaction.name,
        category: category ? getCategoryLabel(category, categoryList) : 'Uncategorized',
        type: transaction.type === 'expense' ? 'Expense' : 'Saving',
        paymentMode: transaction.payment_mode || '',
        amount: Number(transaction.amount) || 0,
        description: transaction.description || '',
      }
    })
    return downloadSpreadsheet({ rows, columns: REPORT_EXPORT_COLUMNS, filename: makeExportFilename('Transactions', bounds), format })
  }

  async function exportPdf() {
    if (!bounds) throw new Error('Generate a custom date-range report before downloading its PDF.')
    if (loading) throw new Error('Wait for the selected report data to finish loading.')
    const pdfTransactions = filteredTransactions.map((transaction) => {
      const categoryList = transaction.type === 'expense' ? expenseCategories : savingCategories
      const category = categoryList.find((item) => item.id === transaction.category_id)
      return { ...transaction, categoryLabel: category ? getCategoryLabel(category, categoryList) : 'Uncategorized' }
    })
    const rangeLabel = bounds.from === bounds.to ? formatExpenseDate(bounds.from) : `${formatExpenseDate(bounds.from)} - ${formatExpenseDate(bounds.to)}`
    await downloadReportPdf({
      title: `Reports & Analytics - ${reportType}`,
      periodLabel: `${reportTitle} · ${rangeLabel}`,
      generatedAt: new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()),
      totals,
      categoryRows,
      trendRows: trendData,
      transactions: pdfTransactions,
    })
  }

  return (
    <div className="app-shell reports-shell">
      <main className="expense-page reports-page">
        <section className="reports-intro">
          <div><p className="eyebrow">FINANCIAL INSIGHTS</p><h1>Reports &amp; Analytics</h1><p>Analyze your expenses and savings with detailed financial reports.</p></div>
          <span className="reports-intro__range"><CalendarDays size={16} />{headingRange}</span>
          <div className="reports-export-tools"><PdfExportButton onExport={exportPdf} /><ExportActions label="Export data" onExport={exportReport} /></div>
        </section>

        <nav aria-label="Report period" className="reports-tabs">{REPORT_TABS.map((tab) => <button aria-pressed={reportType === tab.value} className={reportType === tab.value ? 'active' : ''} key={tab.value} onClick={() => selectReportType(tab.value)} type="button">{tab.label}</button>)}</nav>

        <section aria-label="Report period controls" className="reports-controls">
          {reportType === 'daily' && <div className="reports-date-control"><button aria-label="Previous day" onClick={() => { setSelectedDate((date) => dayShift(date, -1)); setPage(1) }} type="button"><ChevronLeft size={17} /></button><label><span>Report date</span><input onChange={(event) => { setSelectedDate(event.target.value); setPage(1) }} type="date" value={selectedDate} /></label><button aria-label="Next day" onClick={() => { setSelectedDate((date) => dayShift(date, 1)); setPage(1) }} type="button"><ChevronRight size={17} /></button></div>}
          {reportType === 'monthly' && <div className="reports-select-control"><label><span>Month</span><select aria-label="Report month" onChange={(event) => { setSelectedMonth(Number(event.target.value)); setPage(1) }} value={selectedMonth}>{MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></label><label><span>Year</span><select aria-label="Report year" onChange={(event) => { setSelectedYear(Number(event.target.value)); setPage(1) }} value={selectedYear}>{YEARS.map((year) => <option key={year} value={year}>{year}</option>)}</select></label></div>}
          {reportType === 'yearly' && <div className="reports-select-control"><label><span>Year</span><select aria-label="Report year" onChange={(event) => { setSelectedYear(Number(event.target.value)); setPage(1) }} value={selectedYear}>{YEARS.map((year) => <option key={year} value={year}>{year}</option>)}</select></label></div>}
          {reportType === 'custom' && <div className="reports-custom-control"><label><span>Start date</span><input onChange={(event) => setStartDraft(event.target.value)} type="date" value={startDraft} /></label><label><span>End date</span><input min={startDraft || undefined} onChange={(event) => setEndDraft(event.target.value)} type="date" value={endDraft} /></label><button className="button button--primary button--small" onClick={generateCustomReport} type="button">Generate report</button><button aria-label="Reset date range" className="button button--outline button--small" onClick={resetCustomRange} type="button"><RotateCcw size={14} /> Reset</button>{customError && <p className="reports-validation" role="alert">{customError}</p>}</div>}
        </section>

        <section aria-label="Period summary" className="reports-stats">
          <ReportStat kind="expense" label="Total expenses" note={statNote} value={loading ? 'Loading…' : formatRupees(totals.expenseCents / 100)} />
          <ReportStat kind="saving" label="Total savings" note={statNote} value={loading ? 'Loading…' : formatRupees(totals.savingCents / 100)} />
          <ReportStat kind="count" label="Expense transactions" note="In this report" value={loading ? 'Loading…' : totals.expenseCount.toLocaleString('en-IN')} />
          <ReportStat kind="count" label="Saving transactions" note="In this report" value={loading ? 'Loading…' : totals.savingCount.toLocaleString('en-IN')} />
        </section>

        {error && <p className="form-message form-message--error expense-page__alert" role="alert">{error}</p>}
        {categoryError && <p className="form-message form-message--error expense-page__alert" role="alert">{categoryError}</p>}
        {reportType === 'custom' && !customRange && !customError && <div className="reports-notice">Choose a start and end date, then generate the report to load its analysis.</div>}

        {(reportType !== 'custom' || customRange) && <>
          <section aria-labelledby="report-trends-heading" className="reports-chart-section">
            <div className="reports-section-heading"><div><p className="eyebrow">PERIOD ANALYSIS</p><h2 id="report-trends-heading">{reportType === 'daily' ? 'Daily report' : reportType === 'monthly' ? 'Monthly report' : reportType === 'yearly' ? 'Yearly report' : 'Custom report'}</h2></div><span>{headingRange}</span></div>
            <div className="reports-chart-grid">
              <article className="reports-panel"><div className="reports-panel__heading"><div><h3>{reportType === 'daily' ? 'Expense category totals' : 'Expense trend'}</h3><p>{reportType === 'yearly' ? 'Monthly expenses' : reportType === 'daily' ? 'Category breakdown for selected date' : 'Expenses across the selected period'}</p></div></div>
                {loading ? <div className="reports-loading"><span className="loading-spinner" />Loading report data…</div> : reportType === 'daily' ? categoryRows.length ? <ul className="reports-category-list">{categoryRows.map((category, index) => <li key={category.id}><i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} /><span>{category.label}</span><strong>{formatRupees(category.amount)}</strong></li>)}</ul> : <div className="reports-empty reports-empty--compact">No expense categories for this date.</div> : <div className="reports-chart"><ResponsiveContainer height="100%" width="100%"><BarChart data={monthlyExpenseTrend} margin={{ top: 10, right: 9, left: 0, bottom: 0 }}><CartesianGrid stroke="rgba(163,186,212,.1)" vertical={false} /><XAxis axisLine={false} dataKey="label" tickLine={false} interval={reportType === 'monthly' && monthlyExpenseTrend.length > 20 ? 4 : 0} tick={{ fill: '#aab8c8', fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} width={52} tick={{ fill: '#748397', fontSize: 9 }} tickFormatter={(value) => value >= 1000 ? `₹${Math.round(value / 1000)}k` : `₹${value}`} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="amount" name="Expenses" fill="#00d5f2" radius={[4, 4, 0, 0]} maxBarSize={28} /></BarChart></ResponsiveContainer></div>}
              </article>
              <article className="reports-panel"><div className="reports-panel__heading"><div><h3>{reportType === 'yearly' ? 'Monthly savings comparison' : 'Savings trend'}</h3><p>{reportType === 'yearly' ? 'Savings across all 12 months' : 'Savings across the selected period'}</p></div></div>
                {loading ? <div className="reports-loading"><span className="loading-spinner" />Loading report data…</div> : <div className="reports-chart"><ResponsiveContainer height="100%" width="100%"><BarChart data={monthlySavingTrend} margin={{ top: 10, right: 9, left: 0, bottom: 0 }}><CartesianGrid stroke="rgba(163,186,212,.1)" vertical={false} /><XAxis axisLine={false} dataKey="label" tickLine={false} interval={reportType === 'monthly' && monthlySavingTrend.length > 20 ? 4 : 0} tick={{ fill: '#aab8c8', fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} width={52} tick={{ fill: '#748397', fontSize: 9 }} tickFormatter={(value) => value >= 1000 ? `₹${Math.round(value / 1000)}k` : `₹${value}`} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="amount" name="Savings" fill="#61cf8c" radius={[4, 4, 0, 0]} maxBarSize={28} /></BarChart></ResponsiveContainer></div>}
              </article>
              {reportType !== 'daily' && <article className="reports-panel reports-panel--category"><div className="reports-panel__heading"><div><h3>Category-wise expenses</h3><p>Transactions grouped by their assigned category</p></div><label><span className="sr-only">Category order</span><select aria-label="Sort categories by spending" onChange={(event) => setCategorySort(event.target.value)} value={categorySort}><option value="highest">Highest first</option><option value="lowest">Lowest first</option></select></label></div>
                {loading ? <div className="reports-loading"><span className="loading-spinner" />Loading category analysis…</div> : categoryRows.length ? <div className="reports-donut-layout"><div className="reports-donut"><ResponsiveContainer height="100%" width="100%"><PieChart><Pie data={categoryRows} dataKey="amount" nameKey="label" innerRadius="60%" outerRadius="86%" paddingAngle={3} stroke="none">{categoryRows.map((row, index) => <Cell fill={CHART_COLORS[index % CHART_COLORS.length]} key={row.id} />)}</Pie><Tooltip formatter={(value) => formatRupees(value)} contentStyle={{ background: '#101b29', border: '1px solid rgba(163,186,212,.2)', borderRadius: 9, color: '#fff' }} /></PieChart></ResponsiveContainer></div><div className="reports-category-table-wrap"><table className="reports-category-table"><thead><tr><th>Category</th><th>Amount</th><th>Count</th><th>Share</th></tr></thead><tbody>{categoryRows.map((row, index) => <tr key={row.id}><td><i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />{row.label}</td><td>{formatRupees(row.amount)}</td><td>{row.count}</td><td>{row.percentage.toFixed(1)}%</td></tr>)}</tbody></table></div></div> : <div className="reports-empty reports-empty--compact">No expense data in this reporting period.</div>}
              </article>}
              {reportType === 'custom' && <article className="reports-panel"><div className="reports-panel__heading"><div><h3>Payment method breakdown</h3><p>Expense and saving totals remain separate</p></div></div>{loading ? <div className="reports-loading"><span className="loading-spinner" />Loading payment breakdown…</div> : paymentBreakdown.length ? <div className="reports-chart"><ResponsiveContainer height="100%" width="100%"><BarChart data={paymentBreakdown} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}><CartesianGrid stroke="rgba(163,186,212,.1)" vertical={false} /><XAxis axisLine={false} dataKey="method" tickLine={false} tick={{ fill: '#aab8c8', fontSize: 9 }} /><YAxis axisLine={false} tickLine={false} width={52} tick={{ fill: '#748397', fontSize: 9 }} tickFormatter={(value) => value >= 1000 ? `₹${Math.round(value / 1000)}k` : `₹${value}`} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="expenses" name="Expenses" fill="#00d5f2" radius={[4, 4, 0, 0]} /><Bar dataKey="savings" name="Savings" fill="#61cf8c" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <div className="reports-empty reports-empty--compact">No payment activity in this range.</div>}</article>}
              {reportType === 'custom' && <article className="reports-panel"><div className="reports-panel__heading"><div><h3>Daily expense and savings trend</h3><p>Separate daily totals for the selected custom range</p></div></div>{loading ? <div className="reports-loading"><span className="loading-spinner" />Loading daily trends…</div> : <div className="reports-chart"><ResponsiveContainer height="100%" width="100%"><LineChart data={trendData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}><CartesianGrid stroke="rgba(163,186,212,.1)" vertical={false} /><XAxis axisLine={false} dataKey="label" tickLine={false} interval={Math.max(0, Math.ceil(trendData.length / 14) - 1)} tick={{ fill: '#aab8c8', fontSize: 9 }} /><YAxis axisLine={false} tickLine={false} width={52} tick={{ fill: '#748397', fontSize: 9 }} tickFormatter={(value) => value >= 1000 ? `₹${Math.round(value / 1000)}k` : `₹${value}`} /><Tooltip content={<ChartTooltip />} /><Line dataKey="expenses" name="Expenses" stroke="#00d5f2" strokeWidth={2} dot={false} /><Line dataKey="savings" name="Savings" stroke="#61cf8c" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>}</article>}
            </div>
            {reportType === 'yearly' && <div className="reports-yearly-note">Year averages include months with no transactions. Highest and lowest expense months are calculated across all 12 months.</div>}
          </section>

          {reportType === 'yearly' && <section aria-label="Yearly highlights" className="reports-yearly-stats"><ReportStat label="Average monthly expenses" value={loading ? '—' : formatRupees(yearlyStats.averageExpense)} /><ReportStat kind="saving" label="Average monthly savings" value={loading ? '—' : formatRupees(yearlyStats.averageSaving)} /><ReportStat label="Highest spending month" value={loading ? '—' : yearlyStats.highestExpense} /><ReportStat label="Lowest spending month" value={loading ? '—' : yearlyStats.lowestExpense} /><ReportStat kind="saving" label="Highest savings month" value={loading ? '—' : yearlyStats.highestSaving} /></section>}

          <section aria-labelledby="report-transactions-heading" className="reports-transactions reports-panel">
            <div className="reports-section-heading reports-section-heading--table"><div><p className="eyebrow">TRANSACTION DETAILS</p><h2 id="report-transactions-heading">Report transactions</h2><span>{loading ? 'Loading records…' : `${filteredTransactions.length.toLocaleString('en-IN')} records · ${headingRange}`}</span></div><div className="reports-table-links"><Link to="/expenses">Expense management <ArrowRight size={14} /></Link><Link to="/savings">Savings management <ArrowRight size={14} /></Link></div></div>
            <div className="reports-filters">
              <label className="reports-search"><span className="sr-only">Search transactions</span><Search aria-hidden="true" size={16} /><input onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search name or description" type="search" value={search} /></label>
              <label><span>Type</span><select onChange={(event) => { setTypeFilter(event.target.value); setPage(1) }} value={typeFilter}><option value="all">All types</option><option value="expense">Expense</option><option value="saving">Saving</option></select></label>
              <label><span>Category</span><select onChange={(event) => { setCategoryFilter(event.target.value); setPage(1) }} value={categoryFilter}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{getCategoryLabel(category, category.transaction_type === 'saving' ? savingCategories : expenseCategories)} · {category.transaction_type === 'saving' ? 'Saving' : 'Expense'}</option>)}</select></label>
              <label><span>Payment method</span><select onChange={(event) => { setPaymentFilter(event.target.value); setPage(1) }} value={paymentFilter}><option value="">All methods</option>{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
              <label><span>Sort by</span><select onChange={(event) => { setSortOrder(event.target.value); setPage(1) }} value={sortOrder}><option value="latest">Latest date</option><option value="oldest">Oldest date</option><option value="highest">Highest amount</option><option value="lowest">Lowest amount</option></select></label>
              <button className="reports-reset-filters" onClick={resetFilters} type="button"><RotateCcw size={14} /> Reset filters</button>
            </div>
            {loading ? <div className="reports-loading reports-loading--table"><span className="loading-spinner" />Loading transactions…</div> : error ? null : visibleTransactions.length === 0 ? <div className="reports-empty"><span className="reports-empty__icon"><CalendarDays size={19} /></span><h3>No transactions found</h3><p>{allTransactions.length ? 'Try changing the search or filters.' : 'There are no expense or saving records in this reporting period.'}</p></div> : <>
              <div className="reports-table-scroll"><table className="reports-table"><thead><tr><th>Date</th><th>Name / Source</th><th>Category</th><th>Type</th><th>Payment method</th><th>Amount</th><th>Description</th></tr></thead><tbody>{visibleTransactions.map((transaction) => {
                const isExpense = transaction.type === 'expense'
                const categoryList = isExpense ? expenseCategories : savingCategories
                const category = categoryList.find((item) => item.id === transaction.category_id)
                const categoryName = category ? getCategoryLabel(category, categoryList) : 'Uncategorized'
                return <tr key={`${transaction.type}-${transaction.id}`}><td>{formatExpenseDate(transaction.transactionDate)}</td><td><Link className="reports-transaction-link" to={isExpense ? '/expenses' : '/savings'}>{transaction.name}</Link></td><td>{categoryName}</td><td><span className={`reports-type reports-type--${transaction.type}`}>{isExpense ? 'Expense' : 'Saving'}</span></td><td>{transaction.payment_mode || '—'}</td><td className={`reports-amount ${isExpense ? 'reports-amount--expense' : 'reports-amount--saving'}`}>{isExpense ? '−' : '+'}{formatRupees(transaction.amount)}</td><td className="reports-description">{transaction.description || '—'}</td></tr>
              })}</tbody></table></div>
              <div className="reports-pagination"><span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredTransactions.length)} of {filteredTransactions.length.toLocaleString('en-IN')}</span><div><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button"><ChevronLeft size={17} /></button><span>Page {page} of {pageCount}</span><button aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} type="button"><ChevronRight size={17} /></button></div></div>
            </>}
          </section>
        </>}
      </main>
    </div>
  )
}

export default Reports
