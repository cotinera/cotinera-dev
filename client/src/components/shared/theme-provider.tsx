import { createContext, useContext, useEffect, useState } from "react";

// Remove the "system" option, only use "dark" or "light"
type Theme = "dark" | "light";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "light", // Default to light theme
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "light", // Default to light theme
  storageKey = "ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => {
      // Get the stored theme, defaulting to light if not found
      const storedTheme = localStorage.getItem(storageKey);
      // If stored theme is "system", convert to light to prevent errors
      if (storedTheme === "system" || !storedTheme) {
        return defaultTheme;
      }
      return storedTheme as Theme;
    }
  );

  useEffect(() => {
    const root = window.document.documentElement;
    // Remove both theme classes
    root.classList.remove("light", "dark");
    // Add the current theme
    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider value={value} {...props}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};