import { useRef, useState } from 'react'
import { ArrowRight, Plus } from 'lucide-react'
import { PAYMENT_METHODS } from '../lib/expenses.js'
import { toLocalDateString } from '../lib/expenses.js'

function getEmptyValues() {
  return {
    vendor: '',
    amount: '',
    category_id: '',
    expense_date: toLocalDateString(),
    payment_mode: '',
    description: '',
    notes: '',
  }
}

function ExpenseForm({
  categories,
  initialValues,
  onSubmit,
  onCancel,
  submitting,
  title = 'Add an expense',
  submitLabel = 'Save expense',
  titleId,
}) {
  const [values, setValues] = useState(() => initialValues || getEmptyValues())
  const [error, setError] = useState('')
  const submitLock = useRef(false)

  function changeField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitLock.current || submitting) return
    setError('')

    if (!values.vendor.trim()) return setError('Enter an expense name or vendor.')
    if (!values.amount || !Number.isFinite(Number(values.amount)) || Number(values.amount) <= 0) {
      return setError('Enter an amount greater than zero.')
    }
    if (!values.category_id) return setError('Choose an expense category.')
    if (!values.expense_date) return setError('Choose the expense date.')
    if (!values.payment_mode) return setError('Choose a payment method.')

    submitLock.current = true
    try {
      await onSubmit(values)
      if (!initialValues) setValues(getEmptyValues())
    } catch (submitError) {
      setError(submitError.message || 'Unable to save this expense. Please try again.')
    } finally {
      submitLock.current = false
    }
  }

  return (
    <form className="expense-form" onSubmit={handleSubmit}>
      <div className="expense-section-heading">
        <div>
          <p className="eyebrow">{initialValues ? 'UPDATE RECORD' : 'QUICK ENTRY'}</p>
          <h2 id={titleId}>{title}</h2>
        </div>
      </div>
      <div className="expense-form__grid">
        <label className="expense-field">
          <span>Expense name / vendor <b>*</b></span>
          <input autoComplete="off" maxLength={120} name="vendor" onChange={changeField} placeholder="e.g. Petrol" required value={values.vendor} />
        </label>
        <label className="expense-field">
          <span>Amount (₹) <b>*</b></span>
          <input min="0.01" name="amount" onChange={changeField} placeholder="0.00" required step="0.01" type="number" value={values.amount} />
        </label>
        <label className="expense-field">
          <span>Category <b>*</b></span>
          <select name="category_id" onChange={changeField} required value={values.category_id}>
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </select>
        </label>
        <label className="expense-field">
          <span>Expense date <b>*</b></span>
          <input max="9999-12-31" name="expense_date" onChange={changeField} required type="date" value={values.expense_date} />
        </label>
        <label className="expense-field">
          <span>Payment method <b>*</b></span>
          <select name="payment_mode" onChange={changeField} required value={values.payment_mode}>
            <option value="">Select payment method</option>
            {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
          </select>
        </label>
        <label className="expense-field">
          <span>Description</span>
          <input maxLength={240} name="description" onChange={changeField} placeholder="What was this for?" value={values.description} />
        </label>
        <label className="expense-field expense-field--wide">
          <span>Notes <small>(optional)</small></span>
          <textarea maxLength={500} name="notes" onChange={changeField} placeholder="Add any details you want to remember" rows="3" value={values.notes} />
        </label>
      </div>
      {categories.length === 0 && <p className="expense-inline-note">No expense categories are available for your account yet. Add an expense category in your existing category setup to continue.</p>}
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      <div className="expense-form__actions">
        {onCancel && <button className="button button--outline" onClick={onCancel} type="button">Cancel</button>}
        <button className="button button--primary" disabled={submitting || categories.length === 0} type="submit">
          {submitting ? <><span className="loading-spinner loading-spinner--small" /> Saving…</> : <>{initialValues ? <ArrowRight size={16} /> : <Plus size={16} />}{submitLabel}</>}
        </button>
      </div>
    </form>
  )
}

export default ExpenseForm
