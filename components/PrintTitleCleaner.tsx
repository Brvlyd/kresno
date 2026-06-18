"use client";

import { useEffect } from "react";

export default function PrintTitleCleaner() {
  useEffect(() => {
    let originalTitle = document.title;

    function handleBeforePrint() {
      originalTitle = document.title;
      document.title = "";
    }

    function handleAfterPrint() {
      document.title = originalTitle;
    }

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  return null;
}
