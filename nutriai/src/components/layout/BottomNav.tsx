import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Home, Camera, BookOpen, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/scan", label: "Scan", icon: Camera },
  { to: "/diary", label: "Diary", icon: BookOpen },
  { to: "/progress", label: "Progress", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 pb-[max(env(safe-area-inset-bottom),0.5rem)] px-2 w-full max-w-md">
      <div className="glass mx-auto flex items-center justify-between rounded-[2rem] px-2 py-2 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)]">
        {NAV.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="relative flex flex-1 flex-col items-center justify-center py-2"
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-2xl bg-white/10"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Icon
                className={cn(
                  "relative z-10 h-5 w-5 transition-colors",
                  active ? "text-white" : "text-white/45"
                )}
                strokeWidth={active ? 2.4 : 2}
              />
              <span
                className={cn(
                  "relative z-10 mt-0.5 text-[10px] font-medium transition-colors",
                  active ? "text-white" : "text-white/45"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
