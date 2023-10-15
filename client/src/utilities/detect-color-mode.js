import { onMounted, onUnmounted } from "vue";

export default function detectColorMode() {
  function onColorSchemeChange({matches}) {
    if (matches) {
      document.querySelector('html').setAttribute('data-bs-theme', "dark");
    } else {
      document.querySelector('html').setAttribute('data-bs-theme', "light");
    }
  }


  onMounted(() => {
    let colorSchemeMatchMedia = window.matchMedia('(prefers-color-scheme: dark)');

    colorSchemeMatchMedia.addEventListener('change', onColorSchemeChange);
    let userColorModePref = colorSchemeMatchMedia.matches ? "dark" : "light";
    document.querySelector('html').setAttribute('data-bs-theme', userColorModePref);
  });

  onUnmounted(() => {
    let colorSchemeMatchMedia = window.matchMedia('(prefers-color-scheme: dark)');

    colorSchemeMatchMedia.removeEventListener('change', onColorSchemeChange);
  });
}
