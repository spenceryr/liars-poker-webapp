import { createApp } from 'vue'
import 'vite/modulepreload-polyfill';
import App from '/@/pages/index/App.vue';
import '/@/assets/scss/styles.scss'

createApp(App).mount('#app')
