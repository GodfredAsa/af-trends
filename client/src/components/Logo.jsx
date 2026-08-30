export default function Logo({ className = '', height }) {
  return (
    <img
      className={`brand-logo ${className}`.trim()}
      src="/logo.png"
      alt="AF Trends"
      style={height ? { height } : undefined}
    />
  )
}
