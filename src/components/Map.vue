<template>
  <div class="map outer">
    <div class="map-content" id="map" />
    <Info class="info-content"
      :message="infoText"
      :currentTrackIndex="currentTrackIndex"
      :currentSegmentIndex="currentSegmentIndex"
      v-on:size-to-bounds="sizeToBounds($event)"
      v-on:add-rectangle="addRectangle($event)"
      v-on:goto-location="gotoLocation($event)"
      v-on:select-track-index="selectTrackIndex($event)"
      v-on:select-segment-time="selectSegmentByTime($event)"
      v-on:select-waypoint-time="selectWaypointTime($event)"
      v-on:toggle-visibility="toggleVisibility($event)"
    />
  </div>
</template>

<script lang="ts">
import { Component, Inject, Vue, Watch } from 'vue-property-decorator'
import L from 'leaflet'
import { GpxFile, GpxPoint, GpxSegment, GpxTrack, GpxWaypoint, GpxTrackBounds, GpxParser } from '@/models/Gpx'
import { Geo } from '@/models/Geo'
import { GpxStore } from '@/models/GpxStore'
import { PolylineArrows } from '@/models/PolylineArrows'
import Info from '@/components/Info.vue'
import { displayable } from '@/models/Displayable'

interface SegmentPathAndOptions {
  segment: GpxSegment
  path: L.Path
  options: L.PolylineOptions
}

interface WayPointCircleAndOptions {
  waypoint: GpxWaypoint
  circle: L.Circle
  options: L.PathOptions
}


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
  private nameToControlLayer: Map<string, L.Layer> = new Map<string, L.Layer>()
  private visibleTracks:Map<string, L.Layer> = new Map<string, L.FeatureGroup>()
  private displayable = displayable

  private currentTrackIndex: number = -1
  private currentSegmentIndex: number = -1

  private timeToSegment: Map<string, SegmentPathAndOptions> = new Map<string, SegmentPathAndOptions>()
  private timeToWaypoint: Map<string, WayPointCircleAndOptions> = new Map<string, WayPointCircleAndOptions>()

  private selectedPath?: L.Path
  private selectedOptions: L.PathOptions = {}
  private selectedPoint?: L.Circle
  private highlightedPoint?: L.Circle

  private defaultWaypointOptions: L.CircleMarkerOptions = { radius: 3.5, weight: 1, color: 'cyan', fillColor: 'cyan', fillOpacity: 1.0 }
  private noMovementWaypointOptions: L.CircleMarkerOptions = { radius: 8, weight: 2, color: 'saddlebrown', fillColor: 'saddlebrown', fillOpacity: 1.0 }
  private groupedWaypointOptions: L.CircleMarkerOptions = { radius: 8, weight: 4, color: 'red', fillColor: 'red', fillOpacity: 1.0 }

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
    this.onTracksChanged()
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

  private highlightNearestPoint(point: GpxPoint) {
    let options = { color: 'black', opacity: 0.5, radius: 3, fill: true, fillColor: '#40E0D0', fillOpacity: 0.8 }
    if (this.highlightedPoint) {
      this.highlightedPoint
        .setLatLng([point.latitude, point.longitude])
        .addTo(this.map!)
      this.highlightedPoint.options = options
    } else {
      this.highlightedPoint = new L.Circle([point.latitude, point.longitude], options).addTo(this.map!)
    }
  }

  private selectPoint(e: any, point: GpxPoint, circle: L.Circle, originalOptions: L.PathOptions) {
    if (e) {
      e.originalEvent._gpxHandled = true
      e.originalEvent.stopImmediatePropagation()
    }

    let options = { color: '#FF6347', opacity: 0.5, radius: 3, fill: true, fillColor: '#FF6347', fillOpacity: 0.8 }

    if (this.selectedPath || this.highlightedPoint) {
      this.clearSelection()
    }

    if (this.selectedPoint !== circle) {
      this.clearSelection()
      this.selectedPoint = circle
      this.selectedOptions = originalOptions
      circle.setStyle(options)
    }
  }

  private selectWaypoint(e: any, waypoint: GpxWaypoint, circle: L.Circle, originalOptions: L.PathOptions) {
    if (e) {
      e.originalEvent._gpxHandled = true
      e.originalEvent.stopImmediatePropagation()
    }

    let startTime = displayable.timeWithSeconds(waypoint.timestamp, waypoint.timezoneName)
    var message = ''
    if (waypoint.rangic) {
      let finishTime = displayable.timeWithSeconds(waypoint.rangic.finishTime, waypoint.timezoneName)
      let seconds = displayable.duration(waypoint.timestamp, waypoint.rangic.finishTime)
      let distanceMeters = Geo.distanceLL(
        waypoint.rangic.beginLatitude,
        waypoint.rangic.beginLongitude,
        waypoint.rangic.finishLatitude,
        waypoint.rangic.finishLongitude)
      let distance = displayable.milesString(distanceMeters / 1000)
      message = `stop: ${startTime} - ${finishTime}; ${waypoint.rangic.stopType}; ${seconds}, ${distance}`
    } else {
      message = `waypoint: ${startTime}; ${waypoint.name}`
    }

    if (this.selectedPath || this.highlightedPoint) {
      this.clearSelection()
    }

    let options = { color: '#0000CD', opacity: 0.8, radius: 15, fill: true, fillColor: originalOptions.fillColor, fillOpacity: 1.0, weight: 10 }
    if (this.selectedPoint !== circle) {
      this.clearSelection()
      this.selectedPoint = circle
      this.selectedOptions = originalOptions
      circle.setStyle(options)
      circle.setRadius(options.radius)
    }

    this.setSelectedMessage(message)
  }

  private selectPath(e: any, path: L.Path, options: {}, message: string) {
    if (e) {
      e.originalEvent._gpxHandled = true
      e.originalEvent.stopImmediatePropagation()
    }

    if (this.selectedPoint || this.highlightedPoint) {
      this.clearSelection()
    }

    if (path !== this.selectedPath) {
      this.clearSelection()
      this.selectedPath = path
      this.selectedOptions = options
      path.setStyle({color: '#0000FF', weight: 10, opacity: 1})
    }
    this.setSelectedMessage(message)
  }

  private clearSelection() {
    if (this.highlightedPoint) {
      this.highlightedPoint.removeFrom(this.map!)
      this.highlightedPoint = undefined
    }

    if (this.selectedPoint) {
      this.selectedPoint.setStyle(this.selectedOptions)
      if (this.selectedOptions as L.CircleMarkerOptions) {
        let circleOptions: L.CircleMarkerOptions = this.selectedOptions
        this.selectedPoint.setRadius(circleOptions.radius!)
      }
      this.selectedPoint = undefined
    }

    if (this.selectedPath) {
      this.selectedPath.setStyle(this.selectedOptions)
      this.selectedPath = undefined
    }
    this.setSelectedMessage('')
  }

  private makeVisible(object: GpxSegment | GpxWaypoint) {
    let padOptions: L.PanInsideOptions = {
      padding: L.point(100, 100)
    }
    if (GpxParser.isSegment(object)) {
      let pt = object.points[Math.ceil(object.points.length / 2)]
      this.map!.panInside(L.latLng(pt.latitude, pt.longitude), padOptions)
    } else if (GpxParser.isWaypoint(object)) {
      this.map!.panInside(L.latLng(object.latitude, object.longitude), padOptions)
    }
  }

  private sizeToBounds(e: Event) {
    let bounds = (e as unknown) as GpxTrackBounds
    this.map!.fitBounds(L.latLngBounds([bounds.minLat, bounds.minLon], [bounds.maxLat, bounds.maxLon]))
  }

  private addRectangle(e: Event) {
    let rectangle = (e as unknown) as number[]
    let bounds = L.latLngBounds([ 
      [Math.min(rectangle[0], rectangle[2]), Math.min(rectangle[1], rectangle[3])],
      [Math.max(rectangle[0], rectangle[2]), Math.max(rectangle[1], rectangle[3])]
    ])
    new L.Rectangle(bounds, { color: '#FF7788', weight: 5}).addTo(this.map!)
    this.map!.fitBounds(bounds)
  }

  private gotoLocation(e: Event) {
    let pair = (e as unknown) as number[]
    let zoom = this.map!.getZoom()
    this.map!.setView(L.latLng(pair[0], pair[1]), zoom)
  }

  private selectTrackIndex(e: Event) {
    let index = (e as unknown) as number
    this.currentTrackIndex = index
    this.currentSegmentIndex = 0
  }

  private selectSegmentByTime(e: Event) {
    let timeKey = (e as unknown) as string
    let entry = this.timeToSegment.get(timeKey)
    if (entry) {
      this.selectPath(undefined, entry.path, entry.options, '')
      const segmentMessage = this.getSegmentMessage(entry.segment)
      this.setSelectedMessage(`${segmentMessage}`)
      this.makeVisible(entry.segment)
    }
  }

  private selectWaypointTime(e: Event) {
    let timeKey = (e as unknown) as string
    let entry = this.timeToWaypoint.get(timeKey)
    if (entry) {
      // TODO: Need a timezone name for the last parameter
      this.selectWaypoint(undefined, entry.waypoint, entry.circle, entry.options)
      this.makeVisible(entry.waypoint)
    }
  }

  private toggleVisibility(e: Event) {
    let info = (e as unknown) as { timestamp: string, visible: boolean }
    let entry = this.timeToSegment.get(info.timestamp)
    if (entry) {
      if (info.visible) {
        entry.path.addTo(this.map!)
      } else {
        entry.path.removeFrom(this.map!)
      }
    } else {
      let entry = this.timeToWaypoint.get(info.timestamp)
      if (entry) {
        if (info.visible) {
          entry.circle.addTo(this.map!)
        } else {
          entry.circle.removeFrom(this.map!)
        }
      }
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
      this.remove(n, oldLayer as L.FeatureGroup)
      this.visibleTracks.delete(n)
    })
    addedTracks.forEach( (n) => {
      let fg = this.add(n)
      this.visibleTracks.set(n.name, fg)
    })

    if (this.activeTracks.length > 0) {
      let track = this.activeTracks.slice(-1)[0]
      this.defaultInfoText = `${displayable.dayOfWeek(track.startDate, track.timezoneName)}, `
        + `${displayable.date(track.startDate, track.timezoneName)}; `
        + `${displayable.milesString(track.meters / 1000)}, `
        + `${displayable.durationGpx(track)}`
      if (this.currentTrackIndex < 0 || this.currentTrackIndex >= this.activeTracks.length) {
        this.currentTrackIndex = this.activeTracks.length - 1
        this.currentSegmentIndex = 0
      }
    } else {
      this.defaultInfoText = ''
      this.currentTrackIndex = -1
      this.currentSegmentIndex = -1
    }

    this.setSelectedMessage(this.defaultInfoText)
  }

  private remove(name: string, layer: L.FeatureGroup) {
    if (this.mapLayersControl && this.nameToControlLayer.has(name)) {
      this.mapLayersControl.removeLayer(this.nameToControlLayer.get(name)!)
    }
    layer.removeFrom(this.map!)
    if (this.selectedPoint) {
      this.selectedPoint.removeFrom(this.map!)
    }
  }

  private add(gpx: GpxFile): L.FeatureGroup {
    let featureGroup = new L.FeatureGroup()
    gpx.waypoints.forEach( (w, index) => {
      this.addWaypoint(featureGroup, gpx, w, index)
    })
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

  private addWaypoint(fg: L.FeatureGroup, gpx: GpxFile, waypoint: GpxWaypoint, wayPointIndex: number) {
    let options = this.defaultWaypointOptions
    if (waypoint.rangic) {
      if (waypoint.rangic.stopType == "noMovement") {
        options = this.noMovementWaypointOptions
      }
      if (waypoint.rangic.stopType == "groupedStops") {
        options = this.groupedWaypointOptions
      }
    }

    const pt = new L.Circle([waypoint.latitude, waypoint.longitude], options)
    pt.addTo(fg)
    pt.on('click', (e) => {
      const c = pt
      this.selectWaypoint(e, waypoint, c, options)
    })
    this.timeToWaypoint.set(waypoint.timestamp.toString(), { waypoint, circle: pt, options: options })
  }

  private addTrack(fg: L.FeatureGroup, gpx: GpxFile, track: GpxTrack, trackIndex: number) {
    track.segments.forEach( (s, segmentIndex) => {
      this.addSegment(fg, gpx, trackIndex, segmentIndex, s, this.lineOptions[this.nextLineOption])
      ++this.nextLineOption
      if (this.nextLineOption >= this.lineOptions.length) {
        this.nextLineOption = 0
      }
    })
  }

  private addSegment(fg: L.FeatureGroup, gpx: GpxFile, trackIndex: number, segmentIndex: number, 
    segment: GpxSegment, lineOptions: L.PolylineOptions) {
    // Using icons - they're too bright and aren't anchored properly (dynamically)
    // Consider using a DivIcon, as it'll scale better AND could (maybe?) transform the center
    // new L.Marker([segment.points[0].latitude, segment.points[0].longitude], {icon: this.startIcon}).addTo(fg)
    // new L.Marker([segment.points.slice(-1)[0].latitude, segment.points.slice(-1)[0].longitude], { icon: this.endIcon}).addTo(fg)

    // Consider making the arrows an option
    // new PolylineArrows(this.map!, segment, lineOptions).addTo(fg)

    const id = `${gpx.name}; track #${trackIndex + 1}; segment #${segmentIndex + 1}`
    const firstPoint = segment.points[0]
    const lastPoint = segment.points.slice(-1)[0]
    const segmentMessage = this.getSegmentMessage(segment)
    var options = { radius: 5, weight: 1, color: '#33A532', fillColor: '#33A532', fillOpacity: 0.8, className: 'start-end-marker' }
    const start = new L.Circle([segment.points[0].latitude, segment.points[0].longitude], options)
    // start.addTo(fg)
    start.on('click', (e) => {
      // this.showStartPointInfo(gpx, segment, trackIndex, segmentIndex)
      let startTime = displayable.shortTime(segment.points[0].timestamp, segment.timezoneName)
      this.setSelectedMessage(`${segmentMessage}; start`)
      this.selectPoint(e, firstPoint, start, options)
    })

    options.color = '#D70025'
    options.fillColor = '#D70025'
    const end = new L.Circle([segment.points.slice(-1)[0].latitude, segment.points.slice(-1)[0].longitude], options)
    // end.addTo(fg)
    end.on('click', (e) => {
      // this.showEndPointInfo(gpx, segment, trackIndex, segmentIndex)
      this.setSelectedMessage(`${segmentMessage}; end at ${displayable.timeWithSeconds(lastPoint.timestamp, segment.timezoneName)}`)
      this.selectPoint(e, lastPoint, end, options)
    })

    // The raw points layer bogs the site down; only show it when zoomed in enough to see the individual points.
    const rawPointsLayer = new L.LayerGroup()
    const rawPointsOptions = { radius: 0.4, weight: 0.3, color: '#000', fillColor: lineOptions.color, fillOpacity: 0.4 }
    segment.points.forEach( (pt, index) => {
      const c = new L.Circle(new L.LatLng(pt.latitude, pt.longitude), rawPointsOptions)
      c.addTo(rawPointsLayer)
      c.on('click', (e) => {
        let prevPoint = segment.points[Math.max(index - 1, 0)]
        this.showPointInfo(segment, segmentMessage, pt, prevPoint)
        this.selectPoint(e, pt, c, options)
      })
    })

    var rawPointsVisible = false
    const theMap = this.map!
    theMap.on('zoomend', (e) => {
      if (theMap.getZoom() > 19) {
        if (!rawPointsVisible) {
          // Only show raw points when they'd be visible AND they've been selected
          rawPointsVisible = true
          fg.addLayer(rawPointsLayer)
        }
      } else {
        if (rawPointsVisible) {
          rawPointsVisible = false
          fg.removeLayer(rawPointsLayer)
        }
      }
    })


    const latLngList = segment.points.map( (p) => {
      return new L.LatLng(p.latitude, p.longitude)
    })

    let line = new L.Polyline(latLngList, lineOptions)
    line.on('click', (e) => {
      let le = e as L.LeafletMouseEvent
      let nearest = Geo.nearestPoint(segment.points, le.latlng.lat, le.latlng.lng)
      this.selectPath(e, line, lineOptions, '')
      this.showPointInfo(segment, segmentMessage, nearest.point, nearest.prevPoint)
      this.highlightNearestPoint(nearest.point)
      this.currentSegmentIndex = segmentIndex
    })
    line.addTo(fg)

    this.timeToSegment.set(segment.points[0].timestamp.toString(), { segment, path: line, options: lineOptions })
  }

  private getSegmentMessage(segment: GpxSegment): string {
    const firstPoint = segment.points[0]
    const lastPoint = segment.points.slice(-1)[0]
    const speed = displayable.speedMph(displayable.secondsInSegment(segment), segment.meters / 1000)
    return `segment; ` +
      `${displayable.timeWithSeconds(firstPoint.timestamp, segment.timezoneName)} - ` +
      `${displayable.timeWithSeconds(lastPoint.timestamp, segment.timezoneName)}; ` +
      `${displayable.milesString(segment.meters / 1000)}, ` +
      `${speed}, ` +
      `${displayable.durationPoints(firstPoint, lastPoint)}`

  }

  private showPointInfo(segment: GpxSegment, segmentMessage: string, pt: GpxPoint, prevPt: GpxPoint) {
    const secondsFromPrev = displayable.durationAsSeconds(prevPt.timestamp, pt.timestamp)
    const metersFromPrev = pt.calculatedMeters
    const distanceString = displayable.yardsString(metersFromPrev)
    const speedFromPrev = displayable.speedMph(secondsFromPrev, metersFromPrev / 1000)
    const time = displayable.timeWithSeconds(pt.timestamp, segment.timezoneName)
    this.setSelectedMessage(`${segmentMessage}; [ ${time}, ${speedFromPrev} (${distanceString}) ]`)
  }

  private addToMapLayersControl(layer: L.FeatureGroup, name: string) {
    if (this.mapLayersControl == null) {
      this.mapLayersControl = L.control.layers(
          undefined, { [name]: layer }, { position: 'topright', collapsed: false }).addTo(this.map as L.Map)
    } else {
      this.mapLayersControl.addOverlay(layer, name)
    }
    this.nameToControlLayer.set(name, layer)
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
        maxNativeZoom: 19,
        maxZoom: 22,
        attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    }).addTo(this.map)

    L.control.scale({ position: 'bottomright', maxWidth: 300 }).addTo(this.map)

    this.map.on('click', (e) => {
      const me = e as any
      if (me.originalEvent && me.originalEvent._gpxHandled) { return }
      this.clearSelection()
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
.leaflet-bar, .leaflet-bar a, .leaflet-bar a:hover {
  background-color: #666 !important;
}

.leaflet-bar a.leaflet-disabled {
  background-color: #BBB !important;
}

.start-stop-icon {
  width: 32px;
  height: 32px;
}

.direction-arrow-icon {
  width: 32px;
  height: 32px;
}

.gpx-viewer-arrow-polyline {
  transform: scale(1.0);
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
