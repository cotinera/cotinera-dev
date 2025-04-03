
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { UserCircle, LogOut } from "lucide-react";

export function AuthButton() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline text-sm font-medium">
          {user.email}
        </span>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleGoogleLogin}>
        <img src="https://www.google.com/favicon.ico" className="h-4 w-4 mr-2" />
        Sign in with Google
      </Button>
      <Button variant="default" size="sm" asChild>
        <Link href="/auth">
          <UserCircle className="h-4 w-4 mr-2" />
          Login
        </Link>
      </Button>
    </div>
  );
}
