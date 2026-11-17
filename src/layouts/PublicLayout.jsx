import { Outlet } from 'react-router-dom'
import Footer from '../components/Footer.jsx'
import Navbar from '../components/Navbar.jsx'

function PublicLayout() {
  return (
    <div className="site-shell">
      <Navbar />
      <Outlet />
      <Footer />
    </div>
  )
}

export default PublicLayout
