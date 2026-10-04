/**
 * The few places that cannot read CSS variables (web app manifest, browser theme
 * color) use these. They mirror --bg and --accent in src/styles/tokens.css.
 */
export const BRAND = {
  name: "Compass",
  description: "Life is one long storyline. Compass is the window onto it.",
  background: "#07090d",
  themeDark: "#07090d",
} as const;
