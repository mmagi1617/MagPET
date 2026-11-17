import {
  ArrowDownRight,
  ArrowRight,
  ChartNoAxesCombined,
  CircleDollarSign,
  LockKeyhole,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import magendiranPhoto from '../assets/images/magendiran.png'
import '../styles/home-page.css'

const features = [
  {
    icon: LockKeyhole,
    title: 'A personal account',
    description:
      'Create an account and sign in securely to keep your MagPET experience personal.',
    status: 'Available',
  },
  {
    icon: CircleDollarSign,
    title: 'Everyday expense tracking',
    description:
      'Record daily expenses, organize them into categories, and find transactions quickly.',
    status: 'Available',
  },
  {
    icon: ChartNoAxesCombined,
    title: 'Spending insights',
    description:
      'A clearer view of monthly and yearly spending, with helpful visual summaries.',
    status: 'Coming soon',
  },
]

function HomePage() {
  return (
    <main>
      <section aria-labelledby="hero-title" className="hero-section" id="home">
        <div className="hero-glow hero-glow--one" />
        <div className="hero-glow hero-glow--two" />
        <div className="hero-copy">
          <p className="eyebrow">
            <Sparkles aria-hidden="true" size={15} />
            A calmer way to understand everyday spending
          </p>
          <h1 id="hero-title">
            Welcome to <span>MagPET</span>
          </h1>
          <p className="hero-description">
            MagPET makes personal expense tracking feel clear and approachable.
            Sign in to record everyday spending and organize it by category.
          </p>
          <div className="hero-actions">
            <Link className="button button--primary button--large" to="/signup">
              Get Started <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <Link className="button button--outline button--large" to="/signin">
              Sign In
            </Link>
          </div>
          <div className="hero-supporting">
            <span className="supporting-mark">
              <LockKeyhole aria-hidden="true" size={14} />
            </span>
            <span>Private account access, built around you.</span>
          </div>
        </div>
        <div aria-hidden="true" className="hero-visual">
          <div className="visual-ring visual-ring--outer" />
          <div className="visual-ring visual-ring--inner" />
          <div className="visual-core">
            <span className="visual-core__spark">
              <Sparkles size={25} />
            </span>
            <span className="visual-core__label">YOUR MONEY</span>
            <span className="visual-core__title">Your way forward.</span>
            <div className="visual-line">
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="visual-tag visual-tag--top">
            <CircleDollarSign size={17} />
            A clearer everyday
          </div>
          <div className="visual-tag visual-tag--bottom">
            <ArrowDownRight size={17} />
            One step at a time
          </div>
          <span className="visual-dot visual-dot--one" />
          <span className="visual-dot visual-dot--two" />
        </div>
        <a className="hero-scroll" href="#features">
          Explore MagPET <ArrowDownRight aria-hidden="true" size={15} />
        </a>
      </section>

      <section aria-labelledby="features-title" className="features-section" id="features">
        <div className="section-intro">
          <p className="eyebrow">MADE FOR EVERYDAY CLARITY</p>
          <h2 id="features-title">A thoughtful start to better money habits.</h2>
          <p>
            MagPET is growing one useful step at a time. Here’s what you can use
            now, and what we’re working toward.
          </p>
        </div>
        <div className="feature-grid">
          {features.map(({ description, icon: Icon, status, title }, index) => (
            <article className="feature-card" key={title}>
              <div className="feature-card__top">
                <span className="feature-icon">
                  <Icon aria-hidden="true" size={21} strokeWidth={1.8} />
                </span>
                <span
                  className={`feature-status${index < 2 ? ' feature-status--available' : ''}`}
                >
                  {status}
                </span>
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="about-title"
        className="about-section"
        id="about-me"
      >
        <div className="about-photo-wrap">
          <img
            alt="Magendiran"
            className="about-photo"
            src={magendiranPhoto}
          />
          <span className="about-photo-glow" />
        </div>
        <div className="about-copy">
          <p className="eyebrow">THE PERSON BEHIND THE PROJECT</p>
          <h2 id="about-title">A Little About Me</h2>
          <p>
            I’m Magendiran. I enjoy exploring technology, web development, and
            building useful applications. MagPET is a project shaped by that
            interest and a wish to make everyday money tracking feel simpler.
          </p>
        </div>
      </section>
    </main>
  )
}

export default HomePage
