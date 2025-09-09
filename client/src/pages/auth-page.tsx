import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Loader2, Luggage, Plane, MapPin } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useSearchParams } from "@/hooks/use-search-params";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormData = z.infer<typeof authSchema>;

export default function AuthPage() {
  const { login, register, user } = useAuth();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { get } = useSearchParams();
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  // Check if there's a redirect URL in the query params
  useEffect(() => {
    const redirect = get('redirect');
    if (redirect) {
      setRedirectPath(redirect);
    }
  }, [get]);

  useEffect(() => {
    if (user) {
      // If we have a redirect path from a shared link, go there
      if (redirectPath) {
        window.location.href = redirectPath;
      } else {
        window.location.href = "/";
      }
    }
  }, [user, redirectPath]);

  // Add development bypass handler
  const handleDevBypass = () => {
    localStorage.setItem("dev_bypass_auth", "true");
    toast({
      title: "Development Mode Activated",
      description: "Authentication has been bypassed for testing",
    });
    
    // Honor redirect path if present
    window.location.href = redirectPath || "/";
  };

  const form = useForm<FormData>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: FormData) {
    try {
      setIsLoading(true);
      await (isLogin ? login(data) : register(data));
      toast({
        title: "Success",
        description: isLogin ? "Welcome back!" : "Account created successfully",
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message || "Something went wrong",
      });
    } finally {
      setIsLoading(false);
    }
  }

  const handleGoogleLogin = () => {
    // If we have a redirect parameter, add it to the state to preserve it
    const redirectUrl = redirectPath 
      ? `/api/auth/google?state=${encodeURIComponent(redirectPath)}`
      : '/api/auth/google';
    window.location.href = redirectUrl;
  };

  return (
    <div className="min-h-screen bg-gradient-adventure flex items-center justify-center relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-secondary/20" />
      <div className="absolute top-20 left-20 opacity-10">
        <Plane className="h-32 w-32 rotate-12" />
      </div>
      <div className="absolute bottom-20 right-20 opacity-10">
        <MapPin className="h-24 w-24 -rotate-12" />
      </div>
      <div className="absolute top-1/2 left-10 opacity-5">
        <Luggage className="h-40 w-40" />
      </div>
      
      <div className="container relative z-10 flex items-center justify-center">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl w-full">
          {/* Hero Section */}
          <div className="text-white space-y-6 text-center lg:text-left">
            <div className="flex items-center gap-3 justify-center lg:justify-start">
              <div className="p-3 rounded-lg bg-white/20 backdrop-blur shadow-hero">
                <Luggage className="h-8 w-8" />
              </div>
              <h1 className="text-3xl font-bold">Travel Planner</h1>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-4xl lg:text-5xl font-bold leading-tight">
                Plan Your Perfect
                <span className="block bg-gradient-to-r from-yellow-200 to-orange-200 bg-clip-text text-transparent">
                  Group Adventure
                </span>
              </h2>
              
              <p className="text-xl text-white/90 max-w-md">
                Collaborate with friends, discover amazing places, manage expenses, 
                and create unforgettable memories together.
              </p>
            </div>
            
            <div className="flex items-center gap-8 justify-center lg:justify-start">
              <div className="text-center">
                <div className="text-2xl font-bold">500+</div>
                <div className="text-sm text-white/80">Trips Planned</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">2K+</div>
                <div className="text-sm text-white/80">Happy Travelers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">50+</div>
                <div className="text-sm text-white/80">Countries</div>
              </div>
            </div>
          </div>
          
          {/* Auth Form */}
          <div className="flex justify-center">
            <Card className="w-full max-w-md bg-white/10 backdrop-blur border-white/20 shadow-hero">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl text-white">
                  {isLogin ? "Welcome Back" : "Join the Adventure"}
                </CardTitle>
                <CardDescription className="text-white/80">
                  {isLogin
                    ? "Sign in to continue planning your trips"
                    : "Start planning amazing group trips today"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button
                    variant="secondary"
                    onClick={handleGoogleLogin}
                    className="w-full bg-white text-primary hover:bg-white/90 shadow-soft"
                  >
                    <SiGoogle className="mr-2 h-4 w-4" />
                    Continue with Google
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/30" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background/10 backdrop-blur px-2 text-white/70">
                        Or continue with email
                      </span>
                    </div>
                  </div>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Email</FormLabel>
                            <FormControl>
                              <Input 
                                type="email" 
                                placeholder="you@example.com" 
                                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage className="text-orange-200" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Password</FormLabel>
                            <FormControl>
                              <Input 
                                type="password" 
                                placeholder="********" 
                                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage className="text-orange-200" />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        variant="ocean"
                        className="w-full"
                        disabled={isLoading}
                      >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isLogin ? "Sign In" : "Create Account"}
                      </Button>
                    </form>
                  </Form>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-white hover:bg-white/10 border border-white/20"
                    onClick={() => setIsLogin(!isLogin)}
                    disabled={isLoading}
                  >
                    {isLogin
                      ? "Need an account? Sign up"
                      : "Already have an account? Sign in"}
                  </Button>

                  {/* Development Bypass Button */}
                  <div className="pt-4 border-t border-white/20">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-400/40 text-yellow-100"
                      onClick={handleDevBypass}
                    >
                      Developer: Bypass Authentication
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}