import React, { useEffect, useState } from "react";

const ThemeToggle: React.FC = () => {
  const [mode, setMode] = useState<string>(() => localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
    localStorage.setItem("theme", mode);
  }, [mode]);

  return (
    <button onClick={() => setMode(prev => (prev === "dark" ? "light" : "dark"))}>
      {mode === "dark" ? "Light" : "Dark"}
    </button>
  );
};

export default ThemeToggle;



