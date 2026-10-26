export const APPEARANCES = ["light", "dark", "transparent"];

export function loadAppearance() {
  try {
    const theme = JSON.parse(
      localStorage.getItem("ppc-settings") || "{}",
    ).theme;
    return APPEARANCES.includes(theme) ? theme : "dark";
  } catch {
    return "dark";
  }
}

export function saveAppearance(theme) {
  try {
    const saved = JSON.parse(localStorage.getItem("ppc-settings") || "{}");
    localStorage.setItem("ppc-settings", JSON.stringify({ ...saved, theme }));
  } catch {
    /* A restricted storage context can still use the appearance. */
  }
}
