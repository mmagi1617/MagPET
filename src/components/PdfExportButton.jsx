import { useState } from 'react'
import { FileDown } from 'lucide-react'

function PdfExportButton({ onExport }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleExport() {
    if (loading) return
    setLoading(true)
    setMessage('')
    setError('')
    try {
      await onExport()
      setMessage('PDF report downloaded.')
    } catch (exportError) {
      setError(exportError.message || 'Unable to generate this PDF report.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="export-actions export-actions--pdf"><button className="button button--outline button--small" disabled={loading} onClick={handleExport} type="button"><FileDown aria-hidden="true" size={15} />{loading ? 'Creating PDF…' : 'Download PDF'}</button><span aria-live="polite" className="sr-only">{error || message}</span>{(error || message) && <span className={`export-actions__message${error ? ' export-actions__message--error' : ''}`} role={error ? 'alert' : 'status'}>{error || message}</span>}</div>
}

export default PdfExportButton
