import * as React from "react"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}

function Badge({ className = '', variant = 'default', ...props }: BadgeProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'default':
        return 'border-transparent bg-blue-600 text-white hover:bg-blue-700'
      case 'secondary':
        return 'border-transparent bg-gray-100 text-gray-900 hover:bg-gray-200'
      case 'destructive':
        return 'border-transparent bg-red-600 text-white hover:bg-red-700'
      case 'outline':
        return 'text-gray-950 border-gray-200 bg-white'
      default:
        return 'border-transparent bg-blue-600 text-white hover:bg-blue-700'
    }
  }

  return (
    <div
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${getVariantClasses()} ${className}`}
      {...props}
    />
  )
}

export { Badge }