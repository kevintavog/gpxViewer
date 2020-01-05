<template>
  <div class="map outer">
    <div class="map-content" id="map" />
    <Info class="info-content" :message="infoText" />
  </div>
</template>

<script lang="ts">
import { Component, Inject, Vue, Watch } from 'vue-property-decorator'
import L from 'leaflet'
import { GpxFile, GpxTrack, GpxSegment } from '@/models/Gpx'
import { Geo } from '@/models/Geo'
import { GpxStore } from '@/models/GpxStore'
import Info from '@/components/Info.vue'
import { displayable } from '@/models/Displayable'

@Component({
  components: {
    Info
  }
})
export default class MapView extends Vue {
  @Inject('gpxStore') private gpxStore!: GpxStore
  private infoText = ''
  private defaultInfoText = ''
  private map?: L.Map
  private mapLayersControl: L.Control.Layers | null = null
  private visibleTracks:Map<string, L.Layer> = new Map<string, L.FeatureGroup>()
  private displayable = displayable

  private startIcon = new L.Icon({})
  private endIcon = new L.Icon({})
  private nextLineOption = 0
  private lineOptions: L.PolylineOptions[] = [
    { color: '#008B8B', weight: 5, dashArray: '', opacity: 0.9 },
    { color: '#6B8E23', weight: 5, dashArray: '', opacity: 0.9 },
    { color: '#CD5C5C', weight: 5, dashArray: '', opacity: 0.9 },
    { color: '#0000FF', weight: 5, dashArray: '', opacity: 0.7 },
    { color: '#663399', weight: 5, dashArray: '', opacity: 0.9 },
    { color: '#FF69B4', weight: 5, dashArray: '', opacity: 0.9 },
    { color: '#00FFFF', weight: 5, dashArray: '', opacity: 0.7 },
    { color: '#00FF7F', weight: 5, dashArray: '', opacity: 0.8 },
    { color: '#DC143C', weight: 5, dashArray: '', opacity: 0.8 },
    { color: '#87CEFA', weight: 5, dashArray: '', opacity: 0.8 },
    { color: '#6A5ACD', weight: 5, dashArray: '', opacity: 0.8 },
    { color: '#FF4500', weight: 5, dashArray: '', opacity: 0.8 },
  ]

  private mounted() {
    this.initializeMap()
  }

  get activeTracks(): GpxFile[] {
    return this.gpxStore.files
  }

  private setSelectedMessage(message: string) {
    if (!message || message === '') {
      this.infoText = this.defaultInfoText
    } else {
      this.infoText = message
    }
  }

  @Watch('activeTracks')
  private onTracksChanged() {
    const addedTracks = this.activeTracks.filter( (x) => !this.visibleTracks.has(x.name))
    const expected = new Set(this.activeTracks.map( (t) => t.name))
    const visibleTrackNames = [...this.visibleTracks.keys()]
    const removedTracks = visibleTrackNames.filter( (x) => !expected.has(x))

    removedTracks.forEach( (n) => {
      let oldLayer = this.visibleTracks.get(n)
      this.visibleTracks.delete(n)
      this.remove(oldLayer as L.FeatureGroup)
    })
    addedTracks.forEach( (n) => {
      let fg = this.add(n)
      this.visibleTracks.set(n.name, fg)
    })

    if (this.activeTracks.length > 0) {
      let track = this.activeTracks.slice(-1)[0]
      this.defaultInfoText = `${displayable.dayOfWeek(track.startDate)}, `
        + `${displayable.date(track.startDate)}; `
        + `${displayable.distanceMeters(track.meters)}, `
        + `${displayable.durationGpx(track)}`
    } else {
      this.defaultInfoText = ''
    }
    this.setSelectedMessage(this.defaultInfoText)

  }

  private remove(layer: L.FeatureGroup) {
    layer.removeFrom(this.map!)
  }

  private add(gpx: GpxFile): L.FeatureGroup {
    let featureGroup = new L.FeatureGroup()
    gpx.tracks.forEach( (t, index) => {
      this.addTrack(featureGroup, gpx, t, index)
    })
    featureGroup.addTo(this.map!)
    this.addToMapLayersControl(featureGroup, gpx.name)
    if (this.visibleTracks.size < 1) {
      this.map!.fitBounds([
        [gpx.bounds.minLat, gpx.bounds.minLon],
        [gpx.bounds.maxLat, gpx.bounds.maxLon]],
        undefined)

    }
    return featureGroup
  }

  private addTrack(fg: L.FeatureGroup, gpx: GpxFile, track: GpxTrack, trackIndex: number) {
    track.segments.forEach( (s, segmentIndex) => {
      this.addSegment(fg, gpx, trackIndex, segmentIndex, s, this.lineOptions[this.nextLineOption])
    })
    ++this.nextLineOption
    if (this.nextLineOption >= this.lineOptions.length) {
      this.nextLineOption = 0
    }
  }

  private addSegment(fg: L.FeatureGroup, gpx: GpxFile, trackIndex: number, segmentIndex: number, 
    segment: GpxSegment, lineOptions: L.PolylineOptions) {
    // Using icons - they're too bright and aren't anchored properly (dynamically)
    // Consider using a DivIcon, as it'll scale better AND could (maybe?) transform the center
    // const start = new L.Marker([segment.points[0].latitude, segment.points[0].longitude], {icon: this.startIcon})
    // start.addTo(fg)
    // const end = new L.Marker([segment.points.slice(-1)[0].latitude, segment.points.slice(-1)[0].longitude], { icon: this.endIcon})
    // end.addTo(fg)

    const id = `${gpx.name}; track #${trackIndex + 1}; segment #${segmentIndex + 1}`
    var options = { radius: 8, weight: 1, color: '#33A532', fillColor: '#33A532', fillOpacity: 0.8, className: 'start-end-marker' }
    const start = new L.Circle([segment.points[0].latitude, segment.points[0].longitude], options)
    start.addTo(fg)
    start.on('click', (e) => {
      let startTime = displayable.shortTime(segment.points[0].timestamp.toString())
      this.setSelectedMessage(`${id}; ${startTime}, ${displayable.distanceMeters(segment.meters)}`)
    })

    options.color = '#D70025'
    options.fillColor = '#D70025'
    const end = new L.Circle([segment.points.slice(-1)[0].latitude, segment.points.slice(-1)[0].longitude], options)
    end.addTo(fg)
    end.on('click', (e) => {
      let endTime = displayable.shortTime(segment.points.slice(-1)[0].timestamp.toString())
      this.setSelectedMessage(`${id}; ${endTime}, ${displayable.distanceMeters(segment.meters)}`)
    })

    const circleOptions = { radius: 2, weight: 1, color: lineOptions.color, fillColor: lineOptions.color, fillOpacity: 0.5   }
    segment.points.forEach( (pt) => {
      new L.Circle(new L.LatLng(pt.latitude, pt.longitude), circleOptions).addTo(fg)
    })

    const latLngList = segment.points.map( (p) => {
      return new L.LatLng(p.latitude, p.longitude)
    })

    let line = new L.Polyline(latLngList, lineOptions)
    line.on('click', (e) => {
      let le = e as L.LeafletMouseEvent
      let nearest = Geo.nearestPoint(segment.points, le.latlng.lat, le.latlng.lng)
      this.setSelectedMessage(`${id}; ${nearest.distance}, ${nearest.duration}; point ${displayable.shortTime(nearest.point.timestamp.toString())}`)
    })
    line.addTo(fg)
  }

  private addToMapLayersControl(layer: L.FeatureGroup, name: string) {
    if (this.mapLayersControl == null) {
      this.mapLayersControl = L.control.layers(
          undefined, { [name]: layer }, { position: 'topright', collapsed: false }).addTo(this.map as L.Map)
    } else {
      this.mapLayersControl.addOverlay(layer, name)
    }
  }

  private initializeMap() {
    if (this.map) { return }

    this.map = L.map('map', {
        center: [20, 0],
        zoom: 2,
        minZoom: 2,
        zoomControl: false,
    })

    L.control.zoom({ position: 'topright' }).addTo(this.map)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    }).addTo(this.map)

    L.control.scale({ position: 'bottomright' }).addTo(this.map)

    this.map.on('click', (e) => {
      const me = e as any
      if (me.originalEvent && me.originalEvent._gpxHandled) { return }
      // this.clearSelection()
    })

    this.startIcon = new L.Icon({
      iconUrl: 'start.png',
      // iconSize: [16, 16],
      iconAnchor: [16, 16],
      className: 'start-stop-icon'
    })

    this.endIcon = new L.Icon({
      iconUrl: 'end.png',
      // iconSize: [16, 16],
      iconAnchor: [16, 16],
      className: 'start-stop-icon'
    })

    // Used to scale icons at different zoom levels
/*
    const theMap = this.map
    this.map.on('zoomend', (e) => {
      var zoomLevel = Math.min(19, Math.max(2, theMap.getZoom()))
      let iconSize = Math.min(44, 8 + ((zoomLevel - 2) * 1.1 * (zoomLevel / 10)))

      var updated = false
      for (let cssIndex = 0; cssIndex < document.styleSheets.length; ++cssIndex) {
        if (updated) { break }
        let css = document.styleSheets[cssIndex] as CSSStyleSheet
        for (let ruleIndex = 0; ruleIndex < css.cssRules.length; ++ruleIndex) {
          let rule = css.cssRules[ruleIndex] as CSSStyleRule
          if (rule.selectorText === '.start-stop-icon') {
            rule.style.height = `${iconSize}px`
            rule.style.width = `${iconSize}px`
            updated = true
            break
          }
        }
      }
    })
*/
  }
}

</script>

<style>
.start-stop-icon {
  width: 32px;
  height: 32px;
}

.start-end-marker {
  /* transform: scale(1.5); */
}

.start-icon {
  width: 16px;
  height: 16px;
  background-image:url("../../public/start.png");
  background-size: 16px 16px;
}

</style>

<style scoped>
.outer {
  background-color: rgba(48, 48, 48, 0.9);
  color: white;
  flex-grow: 1;
  display: flex;
  flex-flow: column;
  height: 100%;
  padding: 0.1em 0.1em 0.1em 0.1em;
}

.map-content {
  flex: 1 1 auto;
  height: 100%;
}

.info-content {
  color: white;
}

</style>
