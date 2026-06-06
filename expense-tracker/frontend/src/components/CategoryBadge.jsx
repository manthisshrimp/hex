/**
 * CategoryBadge - Displays a category with its color
 *
 * Props:
 *   category: { id, name, color } | null - Category object
 *   size?: 'sm' | 'md' | 'lg' - Badge size (default: 'md')
 *   variant?: 'badge' | 'dot' | 'pill' - Display style (default: 'badge')
 */
export default function CategoryBadge({ category, size = 'md', variant = 'badge' }) {
  if (!category) {
    return (
      <span className={`category-badge category-badge--${size} category-badge--${variant} category-badge--unknown`}>
        {variant === 'dot' ? (
          <span className="category-badge__dot" style={{ backgroundColor: '#6b7280' }} />
        ) : (
          'Unknown'
        )}
      </span>
    )
  }

  const sizeClasses = {
    sm: 'category-badge--sm',
    md: 'category-badge--md',
    lg: 'category-badge--lg',
  }

  const variantClasses = {
    badge: 'category-badge--badge',
    dot: 'category-badge--dot',
    pill: 'category-badge--pill',
  }

  const className = `category-badge ${sizeClasses[size] || ''} ${variantClasses[variant] || ''}`

  if (variant === 'dot') {
    return (
      <span className={className} title={category.name}>
        <span
          className="category-badge__dot"
          style={{ backgroundColor: category.color }}
        />
      </span>
    )
  }

  if (variant === 'pill') {
    return (
      <span
        className={className}
        style={{
          backgroundColor: `${category.color}20`, // 20 = ~12% opacity
          color: category.color,
          borderColor: category.color,
        }}
      >
        <span
          className="category-badge__indicator"
          style={{ backgroundColor: category.color }}
        />
        {category.name}
      </span>
    )
  }

  // Default badge style
  return (
    <span
      className={className}
      style={{
        backgroundColor: category.color,
        color: getContrastColor(category.color),
      }}
    >
      {category.name}
    </span>
  )
}

// Helper to determine text color based on background brightness
function getContrastColor(hexColor) {
  // Remove # and convert to RGB
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white for dark backgrounds, black for light
  return luminance > 0.5 ? '#000000' : '#ffffff';
}
