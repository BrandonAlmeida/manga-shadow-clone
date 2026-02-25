import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

const tailwindConfig: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        neutral: colors.neutral,
      },
    },
  },
};

export default tailwindConfig;
