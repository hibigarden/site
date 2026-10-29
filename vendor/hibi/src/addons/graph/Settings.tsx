import { useState } from 'react'
import { SettingRow, Slider } from '../ui'
import { defaultZoom, setDefaultZoom } from './preferences'

export function Settings() {
  const [zoom, setZoom] = useState(defaultZoom)
  return (
    <div className="settings-group">
      <SettingRow
        id="graph-default-zoom"
        label="Default zoom"
        description="Applied when you next open the graph."
      >
        <div className="setting-controls">
          <div className="padding-control">
            <Slider
              id="graph-default-zoom"
              min="1"
              max="12"
              step="1"
              value={zoom}
              onChange={(event) => {
                const next = Number(event.target.value)
                setZoom(next)
                setDefaultZoom(next)
              }}
            />
            <output htmlFor="graph-default-zoom">{zoom}×</output>
          </div>
        </div>
      </SettingRow>
    </div>
  )
}
