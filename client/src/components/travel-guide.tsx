import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plane, Map, Users, Calendar, CheckSquare } from "lucide-react";

// Character expressions for different moods
const GuideExpressions = {
  happy: "^‿^",
  explaining: "¬‿¬",
  excited: "＼(＾▽＾)／",
  thinking: "(￣～￣;)",
  pointing: "( ´▽`)ﾉ",
} as const;

interface TutorialStep {
  title: string;
  description: string;
  icon: typeof Plane;
  expression: keyof typeof GuideExpressions;
  highlight?: string;
  position?: "top" | "bottom" | "left" | "right";
}

const tutorialSteps: TutorialStep[] = [
  {
    title: "Welcome to PGC!",
    description: "I'm Marco, your travel companion! Let me show you around our awesome trip planning tools!",
    icon: Plane,
    expression: "excited",
  },
  {
    title: "Create Your First Trip",
    description: "Start by clicking the 'New Trip' button to plan your adventure!",
    icon: Map,
    expression: "pointing",
    highlight: "[data-tutorial='new-trip']",
    position: "bottom",
  },
  {
    title: "Invite Your Friends",
    description: "Planning is better together! Add your travel buddies to coordinate.",
    icon: Users,
    expression: "happy",
    highlight: "[data-tutorial='participants']",
    position: "right",
  },
  {
    title: "Schedule Activities",
    description: "Use the calendar to organize your daily activities and keep everyone in sync!",
    icon: Calendar,
    expression: "explaining",
    highlight: "[data-tutorial='calendar']",
    position: "left",
  },
  {
    title: "Track Everything",
    description: "Keep track of bookings, todos, and shared notes in one place!",
    icon: CheckSquare,
    expression: "thinking",
    highlight: "[data-tutorial='checklist']",
    position: "right",
  },
];

interface TravelGuideProps {
  onComplete: () => void;
  isFirstTime?: boolean;
}

export function TravelGuide({ onComplete, isFirstTime = true }: TravelGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(isFirstTime);

  const step = tutorialSteps[currentStep];
  const Icon = step.icon;

  // Handle step navigation
  const nextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsVisible(false);
      onComplete();
    }
  };

  const skipTutorial = () => {
    setIsVisible(false);
    onComplete();
  };

  // Highlight the target element
  useEffect(() => {
    if (step.highlight) {
      const element = document.querySelector(step.highlight);
      if (element) {
        element.classList.add("tutorial-highlight");
        return () => element.classList.remove("tutorial-highlight");
      }
    }
  }, [currentStep, step.highlight]);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <Card className="w-[320px] shadow-lg">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Icon className="h-5 w-5 text-primary" />
              </motion.div>
              <CardTitle className="text-lg">{step.title}</CardTitle>
            </div>
            <CardDescription>
              <span className="font-mono text-xl mr-2">
                {GuideExpressions[step.expression]}
              </span>
              {step.description}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-between">
            <Button variant="ghost" size="sm" onClick={skipTutorial}>
              Skip Tour
            </Button>
            <Button onClick={nextStep}>
              {currentStep === tutorialSteps.length - 1 ? "Get Started" : "Next"}
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}