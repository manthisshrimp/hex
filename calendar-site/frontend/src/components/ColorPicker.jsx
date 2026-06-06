import React from 'react';

const COLORS = [
  { hex: '#3b82f6', name: 'work' },
  { hex: '#f59e0b', name: 'appointments' },
  { hex: '#22c55e', name: 'personal' },
  { hex: '#ef4444', name: 'urgent' },
  { hex: '#8b5cf6', name: 'social' },
  { hex: '#ec4899', name: 'family' },
  { hex: '#06b6d4', name: 'travel' },
  { hex: '#6b7280', name: 'misc' },
];

function ColorPicker({ selectedColor, onChange }) {
  const [customColor, setCustomColor] = React.useState('');

  const handleColorChange = (color) => {
    onChange(color);
    setCustomColor('');
  };

  const handleCustomChange = (e) => {
    const value = e.target.value;
    setCustomColor(value);
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      onChange(value);
    }
  };

  return (
    <div className="color-picker">
      <div className="color-grid">
        {COLORS.map((color) => (
          <button
            key={color.hex}
            type="button"
            className={`color-swatch ${selectedColor === color.hex ? 'selected' : ''}`}
            style={{ backgroundColor: color.hex }}
            onClick={() => handleColorChange(color.hex)}
            title={color.name}
            aria-label={color.name}
          />
        ))}
      </div>
      <div className="color-picker-custom">
        <input
          type="text"
          placeholder="Custom hex (#RRGGBB)"
          value={customColor}
          onChange={handleCustomChange}
          className="color-input"
        />
      </div>
    </div>
  );
}

export default ColorPicker;
