"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    // Im Dev-Server würde der Cache Hot Reload verfälschen.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);
  return null;
}
