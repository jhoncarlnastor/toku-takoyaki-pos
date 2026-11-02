"use client";

import { useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const TIMEOUT = 5 * 60 * 1000; // 5 minutes

export default function AutoLogout() {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = useCallback(async (reason: string = "Session expired due to inactivity.") => {
    try {
      await supabase.auth.signOut();
      await fetch("/api/auth/logout", { method: "POST" });
      localStorage.removeItem("user_session");
      sessionStorage.removeItem("app_authenticated");
      if (reason) alert(reason);
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);
      router.push("/login");
      router.refresh();
    }
  }, [router]);

  // 1. Force logout on fresh browser / tab session if sessionStorage flag is missing
  useEffect(() => {
    // Exclude public routes (/login, /customer-view)
    if (pathname === "/login" || pathname.startsWith("/customer-view")) return;

    const isAuthed = sessionStorage.getItem("app_authenticated");
    if (!isAuthed) {
      handleLogout("Fresh session detected. Please log in.");
    }
  }, [pathname, handleLogout]);

  // 2. Browser close cleanup
  useEffect(() => {
    const handleBeforeUnload = () => {};
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // 3. Inactivity timer
  useEffect(() => {
    // Exclude public routes (/login, /customer-view)
    if (pathname === "/login" || pathname.startsWith("/customer-view")) return;

    let timer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => handleLogout("Session expired due to inactivity."), TIMEOUT);
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      clearTimeout(timer);
    };
  }, [pathname, handleLogout]);

  return null;
}
