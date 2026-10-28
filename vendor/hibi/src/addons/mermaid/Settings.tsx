import { useEffect, useState } from 'react'
import { SettingRow, Slider } from '../ui'
import {
  getPreferences,
  heightStep,
  maximumHeight,
  minimumHeight,
  setPreferences,
  settingsEvent,
} from './preferences'

export function Settings() {
  const [preferences, update] = useState(getPreferences)
  useEffect(() => {
    const change = () => update(getPreferences())
    window.addEventListener(settingsEvent, change)
    return () => window.removeEventListener(settingsEvent, change)
  }, [])
  return (
    <div className="settings-group">
      <SettingRow
        id="mermaid-max-height"
        label="Maximum height"
        description="Scale taller diagrams to fit the editor pane."
      >
        <div className="setting-controls">
          <div className="padding-control">
            <Slider
              id="mermaid-max-height"
              min={minimumHeight}
              max={maximumHeight}
              step={heightStep}
              value={preferences.maxHeight}
              onChange={(event) =>
                setPreferences({ maxHeight: Number(event.target.value) })
              }
            />
            <output htmlFor="mermaid-max-height">
              {preferences.maxHeight}px
            </output>
          </div>
        </div>
      </SettingRow>
    </div>
  )
}
