import L from 'leaflet'
import { Geo } from '@/models/Geo';
import { GpxSegment, GpxPoint } from '@/models/Gpx';
import { displayable } from './Displayable';

export class PolylineArrows {
  // private directionIcon = new L.Icon({})
  private arrows: L.Polyline[]
  // private markers: L.Marker[]
  private arrowAngle = 160
  private arrowLengthMeters = 145
  private arrowOptions: L.PolylineOptions = {
    fill: true,
    color: '#000000',
    opacity: 1,
    fillColor: '#8A2BE2',
    fillOpacity: 1,
    weight: 2,
    stroke: true,
    lineCap: 'square',
    lineJoin: 'miter',
    className: 'gpx-viewer-arrow-polyline'
  }

  constructor(map: L.Map, segment: GpxSegment, lineOptions: L.PolylineOptions) {
    // this.directionIcon = new L.Icon({
    //   iconUrl: 'direction-arrow.png',
    //   iconSize: [16, 16],
    //   iconAnchor: [8, 8],
    //   // className: 'direction-arrow-icon'
    // })

    // this.arrowOptions.fillOpacity = lineOptions.opacity
    // this.arrowOptions.fillColor = lineOptions.fillColor
    let indices = this.arrowIndices(segment)

//     this.markers = indices.map( (idx) => {
//       let point = segment.points[idx]
//       let prevPoint = segment.points[idx - 1]
//       let bearing = Geo.bearing(prevPoint.latitude, prevPoint.longitude, point.latitude, point.longitude)
// console.log(`arrow at ${point.timestamp}`)
//       return this.createArrowMarker(point.latitude, point.longitude, bearing)
//     })
    this.arrows = indices.map( (idx) => {
      let point = segment.points[idx]
      let prevPoint = segment.points[idx - 1]
      let bearing = Geo.bearing(prevPoint.latitude, prevPoint.longitude, point.latitude, point.longitude)
      // return this.createArrowLine2(map, point.latitude, point.longitude, bearing, lineOptions)
      return this.createArrowLine(point.latitude, point.longitude, bearing, lineOptions)
    })
  }

  public addTo(map: L.Map | L.LayerGroup): this {
    this.arrows.forEach( (a) => { a.addTo(map) })
    // this.markers.forEach( (m) => {
    //   m.addTo(map)
    // })
    return this
  }

  // private createArrowMarker(lat: number, lon: number, bearing: number): L.Marker {
  //   return new L.Marker([lat, lon], { icon: this.directionIcon, title: `Bearing: ${bearing}` })
  // }

  private createArrowLine2(map: L.Map, lat: number, lon: number, bearing: number, options: {}): L.Polyline {
    let headAngle = 60
    let pixelSize = 10
    let degToRad = Math.PI / 180
    let direction = (-(bearing - 90)) * degToRad
    let radianArrowAngle = headAngle / 2 * degToRad
    let tipPoint = map.project([lat, lon], 10)

    let headAngle1 = direction + radianArrowAngle
    let headAngle2 = direction - radianArrowAngle
    let arrowHead1 = L.point(
      tipPoint.x - pixelSize * Math.cos(headAngle1),
      tipPoint.y + pixelSize * Math.sin(headAngle1))
    let arrowHead2 = L.point(
      tipPoint.x - pixelSize * Math.cos(headAngle2),
      tipPoint.y + pixelSize * Math.sin(headAngle2))

    return new L.Polyline([
      map.unproject(arrowHead1, 18),
      [lat, lon],
      map.unproject(arrowHead2, 18),
    ],
    // {...options, ...this.arrowOptions})
    this.arrowOptions)
  }

  private createArrowLine(lat: number, lon: number, bearing: number, options: {}): L.Polyline {
    const left = Geo.pointAlongBearing(lat, lon, (bearing + this.arrowAngle + 360) % 360, this.arrowLengthMeters)
    const right = Geo.pointAlongBearing(lat, lon, (bearing - this.arrowAngle + 360) % 360, this.arrowLengthMeters)
    return new L.Polyline([
      [left.lat, left.lon],
      [lat, lon],
      [right.lat, right.lon],
      [left.lat, left.lon],
    ],
    // {...options, ...this.arrowOptions})
    this.arrowOptions)
  }

  private arrowIndices(segment: GpxSegment): number[] {
    const len = segment.points.length
    if (len < 3) {
      return []
    }
    if (len < 7 * 60) {
      return [Math.floor(len / 2)]
    }
    if (len < 15 * 60) {
      return [Math.floor(len / 3), Math.floor(len * 2 / 3)]
    }

    let prevPoint = segment.points[10]
    var indices: number[] = []
    segment.points.forEach( (pt, index) => {
      if (displayable.durationAsSeconds(pt.timestamp, prevPoint.timestamp) > 300) {
        indices.push(index)
      }
    })
    return indices
  }

}
