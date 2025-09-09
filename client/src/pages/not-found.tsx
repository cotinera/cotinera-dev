import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { ArrowLeft, Map, Compass, MapPin } from "lucide-react";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-adventure flex items-center justify-center relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-secondary/20" />
      <div className="absolute top-20 left-20 opacity-10">
        <Map className="h-32 w-32 rotate-12" />
      </div>
      <div className="absolute bottom-20 right-20 opacity-10">
        <Compass className="h-24 w-24 -rotate-12" />
      </div>
      <div className="absolute top-1/2 right-10 opacity-5">
        <MapPin className="h-40 w-40" />
      </div>
      
      <div className="container relative z-10 flex items-center justify-center">
        <Card className="max-w-md w-full bg-white/10 backdrop-blur border-white/20 shadow-hero text-center">
          <CardContent className="p-8 space-y-6">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-white/20 backdrop-blur shadow-soft">
                <Map className="h-16 w-16 text-white" />
              </div>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-4xl font-bold text-white">404</h1>
              <h2 className="text-2xl font-semibold text-white">
                Oops! You're Off the Map
              </h2>
              <p className="text-white/80 max-w-sm mx-auto">
                Looks like you've wandered off the beaten path. The page you're looking for 
                doesn't exist or has been moved to a new destination.
              </p>
            </div>
            
            <div className="space-y-3">
              <Button 
                onClick={() => setLocation("/")}
                variant="ocean"
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Return to Dashboard
              </Button>
              
              <Button 
                onClick={() => window.history.back()}
                variant="ghost"
                className="w-full text-white hover:bg-white/10 border border-white/20"
              >
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}