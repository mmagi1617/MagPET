import { useState } from 'react'
import { FileSpreadsheet, Sheet } from 'lucide-react'

function ExportActions({ onExport, label = 'Export' }) {
  const [formatLoading, setFormatLoading] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function runExport(format) {
    if (formatLoading) return
    setFormatLoading(format)
    setMessage('')
    setError('')
    try {
      const count = await onExport(format)
      setMessage(count ? `${count.toLocaleString('en-IN')} records exported.` : 'No records match the current filters.')
    } catch (exportError) {
      setError(exportError.message || 'Unable to export these records.')
    } finally {
      setFormatLoading('')
    }
  }

  return (
    <div className="export-actions">
      <span className="export-actions__label">{label}</span>
      <button className="button button--outline button--small" disabled={Boolean(formatLoading)} onClick={() => runExport('xlsx')} type="button">
        <FileSpreadsheet aria-hidden="true" size={15} />{formatLoading === 'xlsx' ? 'Preparing…' : 'Excel'}
      </button>
      <button className="button button--outline button--small" disabled={Boolean(formatLoading)} onClick={() => runExport('csv')} type="button">
        <Sheet aria-hidden="true" size={15} />{formatLoading === 'csv' ? 'Preparing…' : 'CSV'}
      </button>
      <span aria-live="polite" className="sr-only">{error || message}</span>
      {(error || message) && <span className={`export-actions__message${error ? ' export-actions__message--error' : ''}`} role={error ? 'alert' : 'status'}>{error || message}</span>}
    </div>
  )
}

export default ExportActions
