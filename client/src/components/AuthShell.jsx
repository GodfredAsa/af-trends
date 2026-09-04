import { Link } from 'react-router-dom'
import { IconLock, IconShirt, IconTruck } from './Icons.jsx'
import Logo from './Logo.jsx'

const POINTS = [
  { icon: <IconTruck />, title: 'Payment before delivery', text: 'Pay first. We deliver nationwide.' },
  { icon: <IconShirt />, title: 'Custom tees', text: 'Pick colour, size, and a print that fits you.' },
  { icon: <IconLock />, title: 'Staff console', text: 'Orders, stock, and the catalog in one place.' },
]

export default function AuthShell({ kicker, title, lede, children }) {
  return (
    <div className="auth-stage">
      <div className="auth-stage-inner">
        <aside className="auth-intro">
          <Link className="auth-intro-logo" to="/">
            <Logo />
          </Link>
          <p className="eyebrow">{kicker}</p>
          <h1>{title}</h1>
          <p>{lede}</p>
          <ul className="auth-points">
            {POINTS.map((point) => (
              <li key={point.title}>
                <span className="auth-point-icon" aria-hidden="true">
                  {point.icon}
                </span>
                <div>
                  <strong>{point.title}</strong>
                  <span>{point.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </aside>
        {children}
      </div>
    </div>
  )
}
