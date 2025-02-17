'use client';

interface ButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit';
}

export function Button({ 
  onClick, 
  children, 
  variant = 'primary', 
  disabled = false,
  fullWidth = false,
  type = 'button'
}: ButtonProps) {
  const baseStyles = "px-4 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50";
  const variantStyles = {
    primary: "bg-foreground text-background hover:opacity-90",
    secondary: "border border-foreground text-foreground hover:bg-foreground hover:text-background"
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      type={type}
      className={`${baseStyles} ${variantStyles[variant]} ${fullWidth ? 'w-full' : ''}`}
    >
      {children}
    </button>
  );
} 