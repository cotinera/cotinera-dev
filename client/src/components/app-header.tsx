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
    <header className="border-b">
      <div className="container flex h-16 items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <Link href="/">
            <div className="flex items-center gap-2 font-semibold text-lg cursor-pointer">
              <Luggage className="h-5 w-5" />
              <span>TravelPlanner</span>
            </div>
          </Link>
        </div>
        
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link href="/my-trips">
                <div className="text-sm font-medium transition-colors hover:text-primary cursor-pointer">
                  My Trips
                </div>
              </Link>
              <UserNotifications />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="p-0 h-8">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar || ""} alt={user.name || user.email} />
                      <AvatarFallback>
                        {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/preferences">
                      <div className="flex items-center cursor-pointer w-full">
                        <UserCircle className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => logout()} 
                    className="cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link href="/auth">
              <Button>Login</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}