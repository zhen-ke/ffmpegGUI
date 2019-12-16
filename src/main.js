import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ElementUI from 'element-ui' // element
import 'element-ui/lib/theme-chalk/index.css' // element css
import 'xterm/css/xterm.css' // xterm css

Vue.use(ElementUI)

Vue.config.productionTip = false

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
