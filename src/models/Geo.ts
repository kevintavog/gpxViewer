import LatLonSpherical from 'geodesy/latlon-spherical'
import { GpxPoint, GpxSegment } from '@/models/Gpx'
import { displayable } from '@/models/Displayable'

export interface GeoNearestPoint {
  point: GpxPoint
  prevPoint: GpxPoint
  distance: string
  duration: string
}

export class Geo {
  static get earthRadiusMeters() {
    return 6372.8 * 1000
  }

  public static parseLatLon(latlon: string): undefined | number[] {
    let data = latlon
    if (!latlon.includes(',')) {
      const tokens = latlon.split(' ')
      if (tokens.length == 2) {
        data = `${tokens[0]}, ${tokens[1]}`
      }
    }

    try {
      const pt = LatLonSpherical.parse(data)
      return [pt.lat,pt.lon]
    } catch {
      return undefined
    }
  }

  public static normalizeDegrees(degrees: number): number {
    if (degrees >= 0 && degrees <= 360) {
      return degrees
    }
    if (degrees > 360) {
      return degrees - 360
    }
    if (degrees < 0) {
      return degrees + 360
    }
    return degrees
  }

  // Returns the distance in meters
  public static distanceGpx(start: GpxPoint, end: GpxPoint): number {
    return this.distanceLL(start.latitude, start.longitude, end.latitude, end.longitude)
  }

  // Returns the distance in meters
  public static distanceSegment(segment: GpxSegment, point: GpxPoint): number {
    var distance = 0
    for (var idx = 1; idx < segment.points.length && segment.points[idx].timestamp <= point.timestamp; ++idx) {
      distance += this.distanceGpx(segment.points[idx - 1], segment.points[idx])
    }
    return distance
  }

  // Returns the distance in meters
  public static distanceLL(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const latDelta = this.toRad(lat2 - lat1)
    const lonDelta = this.toRad(lon2 - lon1)
    const lat1Rad = this.toRad(lat1)
    const lat2Rad = this.toRad(lat2)
    const a = Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
      Math.sin(lonDelta / 2) * Math.sin(lonDelta / 2) *
      Math.cos(lat1Rad) * Math.cos(lat2Rad)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return this.earthRadiusMeters * c
  }

  public static toRad(n: number) {
    return n * Math.PI / 180
  }

  public static toDegrees(n: number) {
    return n * 180 / Math.PI
  }

  public static bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    let lat1Radians = Geo.toRad(lat1)
    let lont1Radians = Geo.toRad(lon1)
    let lat2Radians = Geo.toRad(lat2)
    let lon2Radians = Geo.toRad(lon2)

    let y = Math.sin(lon2Radians - lont1Radians) * Math.cos(lat2Radians)
    let x = Math.cos(lat1Radians) * Math.sin(lat2Radians) -
      Math.sin(lat1Radians) * Math.cos(lat2Radians) * Math.cos(lon2Radians - lont1Radians)
    let bearing = Geo.toDegrees(Math.atan2(y, x))
    return Math.floor((bearing + 360) % 360)
  }

  public static pointAlongBearing(lat: number, lon: number, bearing: number, distanceMeters: number) {
    const bearingRadians = this.toRad(bearing)
    const angularDistance = distanceMeters / this.earthRadiusMeters
    const latRadians = this.toRad(lat)
    const lonRadians = this.toRad(lon)

    const sinNewLat = Math.sin(latRadians) * Math.cos(angularDistance)
      + Math.cos(latRadians) * Math.sin(angularDistance) * Math.cos(bearingRadians)
    const newLat = Math.asin(sinNewLat)
    const y = Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(latRadians)
    const x = Math.cos(angularDistance) - Math.sin(latRadians) * sinNewLat
    const newLon = lonRadians + Math.atan2(y, x)
    return { lat: this.toDegrees(newLat), lon: this.toDegrees(newLon) }
  }

  public static nearestPoint(points: GpxPoint[], latitude: number, longitude: number): GeoNearestPoint {
    var nearestPoint = points[0]
    var prevPoint = nearestPoint
    var bestDistance = this.distanceLL(nearestPoint.latitude, nearestPoint.longitude, latitude, longitude)
    var meters = 0

    var desiredPoint: GpxPoint = { latitude: latitude, longitude: longitude, timestamp: new Date(), calculatedMeters: 0 , elevation: 0, speed: 0, course: 0 }

    points.forEach( (pt, index) => {
      var prior = pt
      if (index > 0) {
        meters += this.distanceGpx(points[index], pt)
        prior = points[index - 1]
      }
      var distance = Geo.distanceGpx(pt, desiredPoint)
      if (distance < bestDistance) {
        bestDistance = distance
        nearestPoint = pt
        prevPoint = prior
      }
    })

    let duration = displayable.duration(points[0].timestamp, nearestPoint.timestamp)
    let distance = displayable.distanceMeters(meters)
    return { point: nearestPoint, prevPoint: prevPoint, distance: distance, duration: duration }
  }

}
