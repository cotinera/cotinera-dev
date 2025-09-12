import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { ChevronDown, LogOut, UserCircle, Luggage } from "lucide-react";
import { UserNotifications } from "@/components/user-notifications";

export function AppHeader() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  
  // Skip rendering header on auth page
  if (location === "/auth") {
    return null;
  }
  
  return (
    <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm shadow-soft sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <Link href="/">
            <div className="flex items-center gap-2 font-semibold text-lg cursor-pointer hover:opacity-80 transition-opacity duration-300">
              <div className="p-2 rounded-lg bg-gradient-adventure text-white shadow-soft">
                <Luggage className="h-5 w-5" />
              </div>
              <span className="bg-gradient-adventure bg-clip-text text-transparent">
                <span className="font-bold">ATLAS</span>
                <span className="text-sm italic ml-1">by PGC</span>
              </span>
            </div>
          </Link>
        </div>
        
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <UserNotifications />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="p-0 h-8 hover:bg-primary/10 transition-all duration-300"
                  >
                    <Avatar className="h-8 w-8 ring-2 ring-primary/20 shadow-soft">
                      <AvatarImage src={user.avatar || ""} alt={user.name || user.email} />
                      <AvatarFallback className="bg-gradient-adventure text-white font-semibold">
                        {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="shadow-card border-border/50">
                  <DropdownMenuItem asChild>
                    <Link href="/preferences">
                      <div className="flex items-center cursor-pointer w-full hover:bg-primary/5 transition-colors">
                        <UserCircle className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => logout()} 
                    className="cursor-pointer hover:bg-destructive/5 text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link href="/auth">
              <Button variant="adventure" className="shadow-soft">
                Get Started
              </Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}