import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        booth: {
          ink: "#15171a",
          paper: "#f7f5f0",
          line: "#d8d3c8",
          mint: "#26b99a",
          coral: "#f36b4f",
          lemon: "#f6c84c",
          cyan: "#2bb3c0",
        },
      },
      boxShadow: {
        panel: "0 18px 50px rgba(21, 23, 26, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
