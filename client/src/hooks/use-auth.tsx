import { ReactNode, createContext, useContext, useState } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
  useQueryClient,
} from "@tanstack/react-query";
import type { User } from "@db/schema";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
  login: (credentials: LoginData) => Promise<User>;
  logout: () => Promise<void>;
  register: (newUser: RegisterData) => Promise<User>;
};

type LoginData = {
  email: string;
  password: string;
};

type RegisterData = LoginData & {
  name?: string;
};

const AuthContext = createContext<AuthContextType | null>(null);

// Common fetch configuration
const fetchConfig: RequestInit = {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);

  const {
    data: user,
    isLoading,
    error: queryError,
  } = useQuery<User | null>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      try {
        // Check if dev bypass is enabled
        const isDevelopmentBypass = localStorage.getItem("dev_bypass_auth") === "true";
        
        if (isDevelopmentBypass) {
          console.log("Using development bypass for authentication");
          // Return a mock dev user that matches the User type from db/schema
          return {
            id: 1,
            email: "dev@example.com",
            password: "", // Not used but required by type
            name: "Development User",
            username: null,
            avatar: null,
            provider: "development",
            provider_id: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            preferences: null
          };
        }
        
        // Normal authentication flow
        const res = await fetch("/api/user", fetchConfig);
        if (res.status === 401) {
          return null;
        }
        if (!res.ok) {
          throw new Error(await res.text());
        }
        return res.json();
      } catch (error) {
        console.error("Auth error:", error);
        setError(error instanceof Error ? error : new Error(String(error)));
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    retry: false, // Don't retry on failure
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await fetch("/api/login", {
        ...fetchConfig,
        method: "POST",
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Login failed");
      }
      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (newUser: RegisterData) => {
      const res = await fetch("/api/register", {
        ...fetchConfig,
        method: "POST",
        body: JSON.stringify(newUser),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Registration failed");
      }
      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Check if dev bypass is enabled
      const isDevelopmentBypass = localStorage.getItem("dev_bypass_auth") === "true";
      
      if (isDevelopmentBypass) {
        console.log("Using development bypass for logout");
        // Remove the bypass flag to "log out"
        localStorage.removeItem("dev_bypass_auth");
        return;
      }
      
      // Normal logout flow
      const res = await fetch("/api/logout", {
        ...fetchConfig,
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Logout failed");
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      queryClient.invalidateQueries(); // Invalidate all queries on logout
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const value = {
    user: user ?? null,
    isLoading,
    error: error || queryError || null,
    loginMutation,
    logoutMutation,
    registerMutation,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    register: registerMutation.mutateAsync,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}