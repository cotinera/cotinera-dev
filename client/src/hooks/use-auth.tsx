import { ReactNode, createContext, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import type { User } from "@db/schema";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, InsertUser>;
  login: (credentials: LoginData) => Promise<User>;
  logout: () => Promise<void>;
  register: (newUser: InsertUser) => Promise<User>;
};

type LoginData = {
  email: string;
  password: string;
};

type InsertUser = {
  email: string;
  password: string;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const res = await fetch("/api/user", {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) return undefined;
        throw new Error(await res.text());
      }
      return res.json();
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
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
    mutationFn: async (newUser: InsertUser) => {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
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
      const res = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        login: loginMutation.mutateAsync,
        logout: logoutMutation.mutateAsync,
        register: registerMutation.mutateAsync,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
