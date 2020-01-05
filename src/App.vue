<template>
  <div id="app">
    <Map class="map" />
  </div>
</template>

<script lang="ts">
import { Component, Provide, Vue } from "vue-property-decorator"
import Map from '@/components/Map.vue'
import { GpxStore } from '@/models/GpxStore'

@Component({
  components: {
    Map
  }
})
export default class App extends Vue {
    @Provide('gpxStore') private gpxStore: GpxStore = new GpxStore()

    private mounted() {
      // On mobile Safari, `vh` ends up being more than is visible, so hack it
      // up to get something more appropriate. 
      // See https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
      let vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
      window.addEventListener('resize', () => {
        let vh = window.innerHeight * 0.01
        document.documentElement.style.setProperty('--vh', `${vh}px`)
      })
    }
}
</script>

<style>
.leaflet-fake-icon-image-2x {
  background-image: url(../node_modules/leaflet/dist/images/marker-icon-2x.png);
}
.leaflet-fake-icon-shadow {
  background-image: url(../node_modules/leaflet/dist/images/marker-shadow.png);
}
@import "../node_modules/leaflet/dist/leaflet.css";

a {
  color: white !important;
}

a:visited {
  color: white !important;
}

a:hover {
  color: white !important;
}

a:link {
  color: white !important;
}

.overrideHoverColor a:hover {
  color: rgb(206, 206, 206) !important;
}


.index-html {
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
  width: 100vw;
  margin: 0;
  padding: 0;
}

body {
  height: 100%;
  width: 100vw;
  margin: 0;
  padding: 0;
}

#app {
  height: 100%;
  width: 100vw;
  margin: 0;
  font-family: "Avenir", Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: left;
  color: white;
  display: flex;
  flex-direction: column;
}

.map {
  background-color: #303030;
  flex: 1;
  color: white;
}
</style>
