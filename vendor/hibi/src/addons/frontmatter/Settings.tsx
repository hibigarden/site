import { useState } from 'react'
import { SettingRow, Toggle } from '../ui'

import { propertiesExpanded } from './preferences'

export function Settings() {
  const [expanded, setExpanded] = useState(propertiesExpanded)
  return (
    <div className="settings-group">
      <SettingRow
        id="frontmatter-expanded"
        label="Expand properties by default"
      >
        <Toggle
          id="frontmatter-expanded"
          checked={expanded}
          onChange={(event) => {
            setExpanded(event.target.checked)
            localStorage.setItem(
              'frontmatter:expanded',
              String(event.target.checked),
            )
          }}
        />
      </SettingRow>
    </div>
  )
}
