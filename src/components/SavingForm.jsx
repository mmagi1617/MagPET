import { useRef, useState } from 'react'
import { ArrowRight, Plus } from 'lucide-react'
import { toLocalDateString } from '../lib/expenses.js'
import { PAYMENT_METHODS } from '../lib/savings.js'

function emptyValues() {
  return {
    source: '',
    amount: '',
    category_id: '',
    saving_date: toLocalDateString(),
    payment_mode: '',
    description: '',
    notes: '',
  }
}

function SavingForm({ categories, initialValues, onSubmit, onCancel, submitting }) {
  const [values, setValues] = useState(() => initialValues || emptyValues())
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
    if (!values.source.trim()) {
      setError('Enter a source or saving name.')
      return
    }
    if (!values.amount || !Number.isFinite(Number(values.amount)) || Number(values.amount) <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    if (!values.category_id) {
      setError('Choose a saving category.')
      return
    }
    if (!values.saving_date) {
      setError('Choose the saving date.')
      return
    }
    if (!values.payment_mode) {
      setError('Choose a payment method.')
      return
    }

    submitLock.current = true
    try {
      await onSubmit(values)
      if (!initialValues) setValues(emptyValues())
    } catch (submitError) {
      setError(submitError.message || 'Unable to save this record. Please try again.')
    } finally {
      submitLock.current = false
    }
  }

  return (
    <form className="expense-form" onSubmit={handleSubmit}>
      <div className="expense-section-heading">
        <div><p className="eyebrow">{initialValues ? 'UPDATE RECORD' : 'QUICK ENTRY'}</p><h2>{initialValues ? 'Edit saving' : 'Add a new saving'}</h2></div>
      </div>
      <div className="expense-form__grid">
        <label className="expense-field"><span>Source / saving name <b>*</b></span><input autoComplete="off" maxLength={120} name="source" onChange={changeField} placeholder="e.g. Bank Deposit" required value={values.source} /></label>
        <label className="expense-field"><span>Amount (₹) <b>*</b></span><input min="0.01" name="amount" onChange={changeField} placeholder="0.00" required step="0.01" type="number" value={values.amount} /></label>
        <label className="expense-field"><span>Category <b>*</b></span><select name="category_id" onChange={changeField} required value={values.category_id}><option value="">Select a saving category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
        <label className="expense-field"><span>Saving date <b>*</b></span><input name="saving_date" onChange={changeField} required type="date" value={values.saving_date} /></label>
        <label className="expense-field"><span>Payment method <b>*</b></span><select name="payment_mode" onChange={changeField} required value={values.payment_mode}><option value="">Select payment method</option>{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
        <label className="expense-field"><span>Description</span><input maxLength={240} name="description" onChange={changeField} placeholder="What was this saving for?" value={values.description} /></label>
        <label className="expense-field expense-field--wide"><span>Notes <small>(optional)</small></span><textarea maxLength={500} name="notes" onChange={changeField} placeholder="Add any details you want to remember" rows="3" value={values.notes} /></label>
      </div>
      {categories.length === 0 && <p className="expense-inline-note">No saving categories are available for your account yet. Add a saving category to continue.</p>}
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      <div className="expense-form__actions">
        {onCancel && <button className="button button--outline" disabled={submitting} onClick={onCancel} type="button">Cancel</button>}
        <button className="button button--primary" disabled={submitting || categories.length === 0} type="submit">{submitting ? <><span className="loading-spinner loading-spinner--small" /> Saving…</> : <>{initialValues ? <ArrowRight size={16} /> : <Plus size={16} />}{initialValues ? 'Save changes' : 'Save saving'}</>}</button>
      </div>
    </form>
  )
}

export default SavingForm
