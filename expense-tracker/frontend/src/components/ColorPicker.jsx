import { useState, useEffect } from 'react'

const PRESET_COLORS = [
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#6b7280', // Gray
  '#84cc16', // Lime
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#a855f7', // Violet
  '#e11d48', // Rose
  '#0ea5e9', // Sky
  '#64748b', // Slate
]

/**
 * ColorPicker - A color picker with preset palette and custom hex input
 *
 * Props:
 *   color: string - Current hex color value
 *   onChange: (color: string) => void - Called when color changes
 *   disabled?: boolean - Disable the picker
 */
export default function ColorPicker({ color, onChange, disabled = false }) {
  const [customHex, setCustomHex] = useState(color || '#6b7280')
  const [error, setError] = useState(null)

  useEffect(() => {
    setCustomHex(color || '#6b7280')
  }, [color])

  function validateHex(hex) {
    const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/
    return hexRegex.test(hex)
  }

  function handleCustomChange(e) {
    const value = e.target.value
    setCustomHex(value)
    setError(null)

    if (validateHex(value)) {
      onChange(value.toLowerCase())
    } else {
      setError('Invalid hex color')
    }
  }

  function handlePresetClick(presetColor) {
    setCustomHex(presetColor)
    setError(null)
    onChange(presetColor)
  }

  return (
    <div className={`color-picker ${disabled ? 'color-picker--disabled' : ''}`}>
      {/* Color preview */}
      <div className="color-picker__preview">
        <div
          className="color-picker__swatch color-picker__swatch--large"
          style={{ backgroundColor: color || '#6b7280' }}
        />
        <span className="color-picker__value">{color || '#6b7280'}</span>
      </div>

      {/* Preset palette */}
      <div className="color-picker__palette">
        {PRESET_COLORS.map((presetColor) => (
          <button
            key={presetColor}
            type="button"
            className={`color-picker__swatch ${color === presetColor ? 'color-picker__swatch--selected' : ''}`}
            style={{ backgroundColor: presetColor }}
            onClick={() => handlePresetClick(presetColor)}
            disabled={disabled}
            aria-label={`Select color ${presetColor}`}
          />
        ))}
      </div>

      {/* Custom hex input */}
      <div className="color-picker__custom">
        <label className="color-picker__label" htmlFor="custom-hex">
          Custom Hex
        </label>
        <input
          id="custom-hex"
          type="text"
          className={`color-picker__input ${error ? 'color-picker__input--error' : ''}`}
          value={customHex}
          onChange={handleCustomChange}
          placeholder="#22c55e"
          disabled={disabled}
          maxLength={7}
        />
        {error && <span className="color-picker__error">{error}</span>}
      </div>
    </div>
  )
}
