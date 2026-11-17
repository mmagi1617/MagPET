import { Link } from 'react-router-dom'
import magiLogo from '../assets/images/magi-logo.png'

function BrandMark({ className = '', to = '/' }) {
  const mark = <img src={magiLogo} alt="MagPET" />

  if (!to) {
    return <span aria-hidden="true" className={`brand-mark ${className}`.trim()}>{mark}</span>
  }

  return (
    <Link
      className={`brand-mark ${className}`.trim()}
      to={to}
      aria-label="MagPET home"
    >
      {mark}
    </Link>
  )
}

export default BrandMark
