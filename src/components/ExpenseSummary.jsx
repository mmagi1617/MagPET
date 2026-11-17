import { CalendarDays, CreditCard, IndianRupee, Wallet } from 'lucide-react'
import { formatRupees } from '../lib/format.js'

const metrics = [
  { key: 'all', label: 'Total expenses', icon: Wallet, format: formatRupees },
  { key: 'today', label: "Today's expenses", icon: CalendarDays, format: formatRupees },
  { key: 'month', label: 'This month', icon: IndianRupee, format: formatRupees },
  { key: 'count', label: 'Transactions', icon: CreditCard, format: (value) => value.toLocaleString('en-IN') },
]

function ExpenseSummary({ summary, loading = false }) {
  return (
    <div className="expense-summary-grid">
      {metrics.map(({ format, icon: Icon, key, label }) => (
        <article className="expense-metric" key={key}>
          <span className="expense-metric__icon"><Icon aria-hidden="true" size={19} /></span>
          <div>
            <p>{label}</p>
            <strong aria-live="polite">{loading ? '—' : format(summary?.[key] ?? 0)}</strong>
          </div>
        </article>
      ))}
    </div>
  )
}

export default ExpenseSummary
