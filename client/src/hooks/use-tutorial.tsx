import { createContext, useContext, useState, useEffect } from 'react';

interface TutorialContextType {
  isFirstTime: boolean;
  completeTutorial: () => void;
  showTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [isFirstTime, setIsFirstTime] = useState(true);

  useEffect(() => {
    const tutorialCompleted = localStorage.getItem('tutorialCompleted');
    setIsFirstTime(!tutorialCompleted);
  }, []);

  const completeTutorial = () => {
    localStorage.setItem('tutorialCompleted', 'true');
    setIsFirstTime(false);
  };

  const showTutorial = () => {
    setIsFirstTime(true);
  };

  return (
    <TutorialContext.Provider value={{ isFirstTime, completeTutorial, showTutorial }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}
