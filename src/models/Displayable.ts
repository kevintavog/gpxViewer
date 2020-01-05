import { GpxFile } from '@/models/Gpx'
import { DateTime } from 'luxon'

export class Displayable {
  public nowWithMsecs(): string {
    return DateTime.local().toFormat('HH:mm:ss.SSS')

  }

  public durationGpx(gpx: GpxFile): string {
    return this.duration(gpx.startDate, gpx.endDate)
  }

  public duration(startDate: Date, endDate: Date): string {
    const end = DateTime.fromISO(endDate.toISOString())
    const start = DateTime.fromISO(startDate.toISOString())
    const diff = end.diff(start, ['hours', 'minutes', 'seconds']).toObject()
    return `${diff.hours}:${this.pad(diff.minutes || 0, 2)}:${this.pad(diff.seconds || 0, 2)}`
  }

  public distance(gpx: GpxFile): string {
    return this.distanceKilometers(gpx.meters)
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

  public pad(num: number, padding: number): string {
    return num.toString().padStart(padding, '0')
  }

  public speed(seconds: number, kilometers: number): string {
      const kmh = kilometers / (seconds / (60 * 60))
      return `${Math.round(10 * kmh) / 10} km/h`
  }

  public speedKmh(kmh: number): string {
    return `${Math.round(10 * kmh) / 10} km/h`
  }

  public dayOfWeek(date: string | Date): string {
    return DateTime.fromISO(new Date(date.toString()).toISOString()).weekdayLong
  }

  public date(date: string | Date): string {
    return new Date(date.toString()).toLocaleDateString('en-US')
  }

  public longDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  public shortTime(date: string): string {
    const ds = this.time(date)
    const ampm = ds.substr(ds.length - 2)
    const t = ds.substring(0, 5)
    if (t.endsWith(':')) {
      return t.substring(0, 4) + '\xa0' + ampm
    }
    return t + '\xa0' + ampm
  }

  public time(date: string): string {
    return new Date(date).toLocaleTimeString('en-US')
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
