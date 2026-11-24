// Applied before first paint (loaded synchronously from index.html) so there is no theme flash.
(function () {
  try {
    var stored = localStorage.getItem("leadagent-theme");
    var theme = stored === "light" || stored === "dark" ? stored : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    var root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    root.style.colorScheme = theme;
  } catch {
    /* keep the `light` class already on <html> */
  }
})();
