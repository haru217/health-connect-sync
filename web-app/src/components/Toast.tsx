import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  duration?: number
  onDismiss: () => void
}

export default function Toast({ message, duration = 3000, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setVisible(false), duration - 300)
    const dismissTimer = setTimeout(onDismiss, duration)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(dismissTimer)
    }
  }, [duration, onDismiss])

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '16px',
        right: '16px',
        padding: '12px 16px',
        borderRadius: '12px',
        background: 'var(--danger-bg, #fef2f2)',
        color: 'var(--danger-color, #dc2626)',
        fontSize: '14px',
        fontWeight: 500,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1000,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
      }}
    >
      {message}
    </div>
  )
}
