import { CalendarDays, Coins, CreditCard, IndianRupee, Landmark } from 'lucide-react'
import { formatRupees } from '../lib/format.js'

const cards = [
  { key: 'all', label: 'Total savings', icon: Coins },
  { key: 'today', label: "Today's savings", icon: CalendarDays },
  { key: 'month', label: 'This month', icon: IndianRupee },
  { key: 'year', label: 'This year', icon: Landmark },
  { key: 'count', label: 'Savings records', icon: CreditCard, count: true },
]

function SavingsSummary({ summary, loading = false }) {
  return (
    <div className="expense-summary-grid savings-summary-grid">
      {cards.map(({ count, icon: Icon, key, label }) => (
        <article className="expense-metric savings-metric" key={key}>
          <span className="expense-metric__icon"><Icon aria-hidden="true" size={19} /></span>
          <div><p>{label}</p><strong aria-live="polite">{loading ? '—' : count ? (summary?.[key] ?? 0).toLocaleString('en-IN') : formatRupees(summary?.[key] ?? 0)}</strong></div>
        </article>
      ))}
    </div>
  )
}

export default SavingsSummary
