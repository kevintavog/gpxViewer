import L from 'leaflet'
import { Geo } from '@/models/Geo';
import { GpxSegment, GpxPoint } from '@/models/Gpx';
import { displayable } from './Displayable';

export class PolylineArrows {
  private arrows: L.Polyline[]
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
    let indices = this.arrowIndices(segment)
    this.arrows = indices.map( (idx) => {
      let point = segment.points[idx]
      let prevPoint = segment.points[idx - 1]
      let bearing = Geo.bearing(prevPoint.latitude, prevPoint.longitude, point.latitude, point.longitude)
      return this.createArrowLine(point.latitude, point.longitude, bearing, lineOptions)
    })
  }

  public addTo(map: L.Map | L.LayerGroup): this {
    this.arrows.forEach( (a) => { a.addTo(map) })
    return this
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

    var prevPoint = segment.points[10]
    var indices: number[] = []
    segment.points.forEach( (pt, index) => {
      let seconds = displayable.durationAsSeconds(prevPoint.timestamp, pt.timestamp)
      let meters = Geo.distanceGpx(prevPoint, pt)
      if (seconds > 300 && meters > 400) {
        indices.push(index)
        prevPoint = pt
      }
    })
    return indices
  }

}
