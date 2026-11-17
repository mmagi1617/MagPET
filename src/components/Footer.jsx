import { Link } from 'react-router-dom'
import BrandMark from './BrandMark.jsx'

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <BrandMark />
          <p>
            A thoughtful starting point for getting to know your everyday
            spending.
          </p>
        </div>
        <div className="footer-links">
          <div>
            <h2>Explore</h2>
            <a href="/#features">Features</a>
            <a href="/#about-me">About Me</a>
          </div>
          <div>
            <h2>Your account</h2>
            <Link to="/signin">Sign In</Link>
            <Link to="/signup">Sign Up</Link>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© MagPET</span>
        <span>Made for more mindful money moments.</span>
      </div>
    </footer>
  )
}

export default Footer
