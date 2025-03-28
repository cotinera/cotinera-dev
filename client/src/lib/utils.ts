import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generates a random hex color
 */
function getRandomHexColor(): string {
  return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
}

/**
 * Generates an SVG gradient based on a seed value (e.g., trip ID)
 * This ensures the same trip always gets the same gradient, but different trips get different gradients
 * 
 * @param seed - A unique identifier (like trip ID) to generate consistent gradients for the same trip
 * @returns - A data URL for the SVG gradient image
 */
export function generateGradientImage(seed: number): string {
  // Use seed to generate deterministic but random-looking colors
  // XOR with some primes to make it look random
  const seedValue = seed ^ 0x173619;
  
  // Generate gradient colors based on seed
  const r1 = (seedValue * 123) % 255;
  const g1 = (seedValue * 456) % 255;
  const b1 = (seedValue * 789) % 255;
  
  const r2 = (seedValue * 667) % 255;
  const g2 = (seedValue * 341) % 255;
  const b2 = (seedValue * 899) % 255;
  
  // Create different gradient types based on seed % 4
  const gradientType = seed % 4;
  
  const color1 = `rgb(${r1}, ${g1}, ${b1})`;
  const color2 = `rgb(${r2}, ${g2}, ${b2})`;
  const color3 = `rgb(${(r1 + r2) / 2}, ${(g1 + g2) / 2}, ${(b1 + b2) / 2})`;
  
  let svgContent = '';
  
  switch (gradientType) {
    case 0: // Linear gradient (diagonal)
      svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${color1}" />
            <stop offset="100%" stop-color="${color2}" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
      </svg>
      `;
      break;
    case 1: // Radial gradient
      svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
        <defs>
          <radialGradient id="grad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" stop-color="${color1}" />
            <stop offset="100%" stop-color="${color2}" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
      </svg>
      `;
      break;
    case 2: // Three-color linear gradient
      svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${color1}" />
            <stop offset="50%" stop-color="${color3}" />
            <stop offset="100%" stop-color="${color2}" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
      </svg>
      `;
      break;
    case 3: // Conic gradient
      svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
        <defs>
          <linearGradient id="grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="${color1}" />
            <stop offset="50%" stop-color="${color2}" />
            <stop offset="100%" stop-color="${color3}" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
      </svg>
      `;
      break;
  }
  
  // Convert SVG to data URL
  return `data:image/svg+xml;base64,${btoa(svgContent)}`;
}
