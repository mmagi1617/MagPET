import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import BrandMark from './BrandMark.jsx'

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <header className="site-header">
      <BrandMark />
      <button
        aria-expanded={menuOpen}
        aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        className="mobile-menu-toggle"
        onClick={() => setMenuOpen((isOpen) => !isOpen)}
        type="button"
      >
        {menuOpen ? <X size={21} /> : <Menu size={21} />}
      </button>
      <nav
        aria-label="Main navigation"
        className={`site-nav${menuOpen ? ' site-nav--open' : ''}`}
      >
        <Link onClick={closeMenu} to="/">
          Home
        </Link>
        <a href="/#features" onClick={closeMenu}>
          Features
        </a>
        <a href="/#about-me" onClick={closeMenu}>
          About Me
        </a>
        <div className="nav-actions">
          <Link className="button button--outline button--small" onClick={closeMenu} to="/signin">
            Sign In
          </Link>
          <Link className="button button--primary button--small" onClick={closeMenu} to="/signup">
            Sign Up
          </Link>
        </div>
      </nav>
    </header>
  )
}

export default Navbar
