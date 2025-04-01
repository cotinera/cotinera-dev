import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { AuthButton } from "@/components/auth";

export function AppHeader() {
  return (
    <header className="bg-white shadow-sm py-3 px-4 sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/">
          <a className="flex items-center gap-2">
            <div className="bg-primary text-white p-1.5 rounded-full">
              <MapPin className="h-4 w-4" />
            </div>
            <span className="font-bold text-lg text-gray-800">TravelPlanner</span>
          </a>
        </Link>
        <div className="flex items-center gap-4">
          <AuthButton />
        </div>
      </div>
    </header>
  );
}