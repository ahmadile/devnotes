import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className, size = 32 }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 32 32" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="32" height="32" rx="8" fill="#6366f1" />
      <path 
        d="M10 10H22V12H10V10ZM10 15H18V17H10V15ZM10 20H14V22H10V20Z" 
        fill="white" 
      />
    </svg>
  );
};
