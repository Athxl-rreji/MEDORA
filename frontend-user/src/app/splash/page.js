"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Splash screen has been removed.
// This redirect ensures any bookmarked /splash links go to the main app.
export default function SplashRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
