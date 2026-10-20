import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        infraredium: {
          ink: "#080d17",
          panel: "#0d1523",
          line: "#1d2a3b",
          cyan: "#75d5dc",
          amber: "#e9a16f",
        },
      },
    },
  },
  plugins: [],
};

export default config;
