import { Gpx, GpxPoint, GpxSegment } from '@/models/Gpx'
import { DateTime, Duration } from 'luxon'

export class Displayable {
  static kilometersPerMile = 0.62137
  static yardsPerMile = 1760
  static feetPerMile = 5280

  public nowWithMsecs(): string {
    return DateTime.local().toFormat('HH:mm:ss.SSS')
  }

  public durationAsSeconds(start: DateTime, end: DateTime): number {
    return Math.abs(start.diff(end).valueOf() / 1000)
  }

  public secondsInSegment(segment: GpxSegment): number {
    let first = segment.points[0]
    let last = segment.points.slice(-1)[0]
    return this.durationAsSeconds(first.timestamp, last.timestamp)
  }

  public formatDuration(duration: Duration): string {
    var format = 'h:mm:ss'
    if (duration.hours == 0) {
      format = 'm:ss'
    }
    return duration.toFormat(format)
  }

  public secondsToDuration(seconds: number): string {
    var format = 'h:mm:ss'
    if (seconds < (60 * 60)) {
      format = 'm:ss'
    }
    return this.formatDuration(Duration.fromMillis(seconds * 1000))
  }

  public durationGpx(gpx: Gpx): string {
    return this.duration(gpx.startDate, gpx.endDate)
  }

  public durationPoints(start: GpxPoint, end: GpxPoint): string {
    return this.duration(start.timestamp, end.timestamp)
  }

  public duration(startDate: DateTime, endDate: DateTime): string {
    if (endDate < startDate) {
      const temp = startDate
      startDate = endDate
      endDate = temp
    }
    return this.formatDuration(endDate.diff(startDate, ['hours', 'minutes', 'seconds']))
  }

  public distance(gpx: Gpx): string {
    return this.milesString(gpx.kilometers)
  }

  public yardsString(meters: number): string {
    return this.milesString(meters / 1000.0)
  }

  public distanceMeters(meters: number): string {
    return this.distanceKilometers(meters / 1000.0)
  }

  public distanceKilometers(km: number): string {
      if (km < 0.001) {
        return `${Math.round(km * 1000 * 100) / 100} meters`
      }
      if (km < 1.0) {
        if (km < 0.010) {
          return `${Math.round(km * 1000 * 10) / 10} meters`
        }
        return `${Math.round(km * 1000)} meters`
      }
      return `${Math.round(100 * km) / 100} km`
  }

  public milesString(km: number): string {
    let miles = km * Displayable.kilometersPerMile
    if (miles < 0.00001) {
      return '-'
    }
    if (miles < 0.0017) {
      return `${Math.round(miles * Displayable.feetPerMile)} feet`
    }
    if (miles < 1.0) {
      if (miles < 0.010) {
        return `${Math.round(miles * Displayable.yardsPerMile * 10) / 10} yards`
      }
      return `${Math.round(miles * Displayable.yardsPerMile)} yards`
    }
    return `${Math.round(100 * miles) / 100} miles`
  }

  public pad(num: number, padding: number): string {
    return num.toString().padStart(padding, '0')
  }

  public speedMs(meters: number, seconds: number): string {
    if (seconds < 0.1) {
      return '- m/s'
    }
    const ms = meters / seconds
    return `${Math.round(100 * ms) / 100} m/s`
  }

  public speedMsToMph(mps: number): string {
    let mph = 2.2369363 * mps
    return `${Math.round(mph)/ 10} mph`
  }

  public speedMph(seconds: number, kilometers: number): string {
    if (seconds < 0.00001 || kilometers < 0.00001) {
      return '-'
    }
    let miles = kilometers * Displayable.kilometersPerMile
    const mph = miles / (seconds / (60 * 60))
    return `${Math.round(10 * mph) / 10} mph`
  }

  public speedKmh(kmh: number): string {
    return `${Math.round(10 * kmh) / 10} km/h`
  }

  public dayOfWeek(date: string | DateTime, zoneName: string): string {
    return this.dateTime(date, zoneName).weekdayLong
  }

  public date(date: string | DateTime, zoneName: string): string {
    return this.dateTime(date, zoneName).setLocale('en-US').toLocaleString()
  }

  public timeWithSeconds(date: string | DateTime, zoneName: string): string {
    return this.dateTime(date, zoneName).toFormat('HH:mm.ss')
  }

  public shortTime(date: string | DateTime, zoneName: string): string {
    return this.dateTime(date, zoneName).toFormat('HH:mm\xa0a')
  }

  public shortTimezoneName(zoneName: string): string {
    return DateTime.utc().setZone(zoneName).offsetNameShort
  }

  public dateTime(date: string | DateTime, zoneName: string): DateTime {
    var iso: string
    if (date instanceof DateTime) {
      iso = (date as DateTime).toISO()
    } else {
      iso = date.toString()
    }
    const zone = zoneName === '' ? 'UTC' : zoneName
    return DateTime.fromISO(iso, { zone })
  }

  public join(list: string[]): string {
      return list.join(', ')
  }

  public firstFew(list: string[]): string {
    if (!list) {
      return ''
    }
    let few = list.slice(0, 2).join(', ')
    if (list.length > 2) {
      few += ', ...'
    }
    return few
  }
}

export const displayable = new Displayable()
