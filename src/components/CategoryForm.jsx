import { useRef, useState } from 'react'
import { ArrowRight, Plus } from 'lucide-react'
import { CATEGORY_TYPES } from '../lib/categories.js'

function CategoryForm({ categories, initialValues, onSubmit, onCancel, submitting }) {
  const [name, setName] = useState(initialValues?.name ?? '')
  const [transactionType, setTransactionType] = useState(initialValues?.transaction_type ?? 'expense')
  const [parentId, setParentId] = useState(initialValues?.parent_id ?? '')
  const [error, setError] = useState('')
  const submitLock = useRef(false)
  const editingId = initialValues?.id
  const excluded = new Set(editingId ? [editingId, ...initialValues.descendantIds] : [])
  const parentOptions = categories.filter(
    (category) => category.transaction_type === transactionType && !excluded.has(category.id),
  )

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitLock.current || submitting) return
    const cleanName = name.trim().replace(/\s+/g, ' ')
    if (!cleanName) {
      setError('Enter a category name.')
      return
    }

    submitLock.current = true
    setError('')
    try {
      await onSubmit({ name: cleanName, transaction_type: transactionType, parent_id: parentId || null })
    } catch (submitError) {
      setError(submitError.message || 'Unable to save this category. Please try again.')
    } finally {
      submitLock.current = false
    }
  }

  return (
    <form className="category-form" onSubmit={handleSubmit}>
      <div className="category-form__grid">
        <label className="expense-field category-form__wide">
          <span>Category name <b>*</b></span>
          <input autoFocus maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="e.g. Bike Accessories" required value={name} />
        </label>
        <label className="expense-field">
          <span>Category type <b>*</b></span>
          <select
            onChange={(event) => {
              setTransactionType(event.target.value)
              setParentId('')
            }}
            required
            value={transactionType}
          >
            {CATEGORY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <label className="expense-field">
          <span>Parent category <small>(optional)</small></span>
          <select onChange={(event) => setParentId(event.target.value)} value={parentId}>
            <option value="">None — make this a parent category</option>
            {parentOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.parent_id ? `↳ ${category.name}` : category.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      <div className="expense-form__actions">
        <button className="button button--outline" disabled={submitting} onClick={onCancel} type="button">Cancel</button>
        <button className="button button--primary" disabled={submitting} type="submit">
          {submitting ? <><span className="loading-spinner loading-spinner--small" /> Saving…</> : <>{editingId ? <ArrowRight size={16} /> : <Plus size={16} />}{editingId ? 'Save changes' : 'Add category'}</>}
        </button>
      </div>
    </form>
  )
}

export default CategoryForm
