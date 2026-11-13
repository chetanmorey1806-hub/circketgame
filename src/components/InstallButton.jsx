import { useEffect, useState } from 'react'
import { onInstallChange, promptInstall, state } from '../app/install.js'

/** Shows "Install game" when the browser allows it (or iPhone instructions). */
export default function InstallButton({ className = '' }) {
  const [s, setS] = useState(state)
  const [help, setHelp] = useState(false)
  useEffect(() => onInstallChange(setS), [])
  if (s.installed) return null
  if (s.canInstall) {
    return (
      <button className={`install-btn ${className}`} onClick={(e) => { e.stopPropagation(); promptInstall() }}>
        <svg viewBox="0 0 24 24" width="1.1em" height="1.1em"><path d="M12 3v12M7 10l5 5 5-5M5 19h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Install game
      </button>
    )
  }
  if (s.ios) {
    return (
      <span className={`install-hint ${className}`} onClick={(e) => { e.stopPropagation(); setHelp((h) => !h) }}>
        📲 Install: tap <b>Share</b> → <b>Add to Home Screen</b>
        {help && <small> — the game then opens full screen like an app.</small>}
      </span>
    )
  }
  return null
}
