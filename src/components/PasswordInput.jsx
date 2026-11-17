import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

function PasswordInput({
  autoComplete,
  id,
  label,
  minLength,
  onChange,
  placeholder,
  value,
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <div className="password-control">
        <input
          autoComplete={autoComplete}
          id={id}
          minLength={minLength}
          onChange={onChange}
          placeholder={placeholder}
          required
          type={visible ? 'text' : 'password'}
          value={value}
        />
        <button
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="password-toggle"
          onClick={() => setVisible((isVisible) => !isVisible)}
          type="button"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  )
}

export default PasswordInput
