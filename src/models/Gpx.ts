import { Geo } from '@/models/Geo'
import { parse, simplifyLostLess } from 'txml'
import { Timezone } from '@/models/Timezone'
import { DateTime } from 'luxon'
import { GeoPoint } from '@/models/Gps'

/*
<gpx [many attributes] >
    <metadata />
    <wpt .../>
    <wpt .../>
    <trk>
        <name>-- name goes here --</name>
        <trkseg>
            <trkpt lat="47.644548" lon="-122.326897">
                <ele>4.46</ele>
                <time>2009-10-17T18:37:26Z</time>
            </trkpt>
        </trkseg>
    </trk>
</gpx>
*/

export interface Gpx {
    waypoints: GpxWaypoint[]
    tracks: GpxTrack[]
    bounds: GpxBounds
    name: string
    startDate: DateTime
    endDate: DateTime
    kilometers: number
    seconds: number
    timezoneName: string
    rangic?: GpxRangicExtension
}

export const emptyGpxBounds: GpxBounds = {
    minLat: 0,
    minLon: 0,
    maxLat: 0,
    maxLon: 0
}

export interface GpxRangicExtension {
    kilometers: number
    seconds: number
    timezoneInfo: GpxRangicTimezoneInfo
    countryNames: string[]
    stateNames: string[]
    cityNames: string[]
    siteNames: string[]
    sites: GpxRangicPlacenameSite[]
    siteToLocation: {[key: string]: GeoPoint}
}

export interface GpxRangicPlacenameSite {
    names: string[]
    latitude: number
    longitude: number
}

export interface GpxWaypoint {
    latitude: number
    longitude: number
    timestamp: DateTime
    seconds: number
    name: string
    comment: string
    timezoneName: string
    rangic?: GpxRangicWaypointExtension
    visible: boolean
}

export interface GpxRangicWaypointExtension {
    stopType: string
    description: string
    beginLatitude: number
    beginLongitude: number
    beginTime: DateTime
    finishLatitude: number
    finishLongitude: number
    finishTime: DateTime
    seconds: number
    bounds: GpxBounds
}

export interface GpxTrack {
    segments: GpxSegment[]
    kilometers: number
    rangic?: GpxRangicTrackExtension
}

export interface GpxRangicTrackExtension {
    kilometers: number
    seconds: number
    bounds: GpxBounds
}

export interface GpxSegment {
    points: GpxPoint[]
    kilometers: number
    seconds: number
    timezoneName: string
    rangic?: GpxRangicSegmentExtension
    visible: boolean
}

export interface GpxRangicSegmentExtension {
    kilometers: number
    kmh: number
    bounds: GpxBounds
    seconds: number
    course: number
    transportationTypes: GpxRangicTransportationType[]
}

export interface GpxPoint {
    latitude: number
    longitude: number
    elevation: number
    timestamp: DateTime
    speed: number
    course: number
    calculatedCourse: number
    calculatedMeters: number
    calculatedKmh: number
    rangic?: GpxRangicPointExtension
}

export interface GpxRangicPointExtension {
    calculatedMeters: number
    calculatedSeconds: number
    calculatedKmh: number
    calculatedCourse: number
    transportationTypes: GpxRangicTransportationType[]
}

export interface GpxBounds {
    minLat: number
    minLon: number
    maxLat: number
    maxLon: number
}

export interface GpxRangicTimezoneInfo {
    tag: string
    id: string
}

export interface GpxRangicTransportationType {
    mode: string
    probability: number
}


export class GpxParser {
    public static isGpx(o: Gpx | GpxSegment | GpxWaypoint): o is Gpx {
        return (o as Gpx).tracks !== undefined
    }

    public static isSegment(o: Gpx | GpxSegment | GpxWaypoint): o is GpxSegment {
        return (o as GpxSegment).points !== undefined
    }

    public static isWaypoint(o: Gpx | GpxSegment | GpxWaypoint): o is GpxWaypoint {
        return (o as GpxWaypoint).name !== undefined
    }

    private minLat = 0
    private maxLat = 0
    private minLon = 0
    private maxLon = 0

    public parse(name: string, xml: string, skipGapDetection: boolean): Promise<Gpx> {
        return this.parse_txml(name, xml, skipGapDetection)
    }

    public parse_txml(name: string, xml: string, skipGapDetection: boolean): Promise<Gpx> {
        return new Promise((resolve, reject) => {
            const firstResult = parse(xml)
            const result = simplifyLostLess(firstResult)

            const gpxArray = result.gpx as []
            if (!result.gpx || !Array.isArray(result.gpx) || gpxArray.length == 0 || !result.gpx[0]) {
                reject(new Error('Not a GPX file'))
                return
            }

            const trackList: GpxTrack[] = []
            for (const track of result.gpx[0].trk) {
                trackList.push(this.processTrack(track, skipGapDetection))
            }

            const timezoneName = trackList[0].segments[0].timezoneName
            const wayPointList: GpxWaypoint[] = []
            if (result.gpx[0].wpt) {
                for (const wayPoint of result.gpx[0].wpt) {
                    wayPointList.push(this.processWaypoint(wayPoint, timezoneName))
                }
            }

            const bounds = {
                maxLat: this.maxLat,
                minLat: this.minLat,
                maxLon: this.maxLon,
                minLon: this.minLon,
            }

            const startDate = trackList[0].segments[0].points[0].timestamp
            const endDate = trackList.slice(-1)[0].segments.slice(-1)[0].points.slice(-1)[0].timestamp
            const x = {
                waypoints: wayPointList,
                tracks: trackList,
                bounds,
                name,
                startDate,
                endDate,
                seconds: endDate.diff(startDate).valueOf() / 1000,
                kilometers: trackList.map( (t) => t.kilometers).reduce( (l, r) => l + r),
                timezoneName,
            } as Gpx


            if (result.gpx[0].extensions && result.gpx[0].extensions[0]['rangic:seconds']) {
                const ext = result.gpx[0].extensions[0]
                // const placenames = this.processPlacenames(rangicXml.sites)
                const siteToLocation: {[key: string]: GeoPoint} = {}
                const siteNames: string[] = []
                // for (const p of placenames) {
                //     for (const n of p.names) {
                //         siteToLocation[n] = { lat: p.latitude, lon: p.longitude }
                //         siteNames.push(n)
                //     }
                // }

                x.rangic = {
                    kilometers: ext['rangic:kilometers'][0],
                    seconds: ext['rangic:seconds'][0],
                    timezoneInfo: {
                        tag: '',
                        id: '',
                    }, // this.processTimezoneInfo(rangicXml.timezoneInfo[0]),
                    countryNames: ext['rangic:countryNames'][0].country,
                    stateNames: ext['rangic:stateNames'][0].state,
                    cityNames: ext['rangic:cityNames'][0].city,
                    sites: ext['rangic:sites'][0].site,
                    siteNames,
                    siteToLocation,
                }
            }

            resolve(x)
        })
    }

    private processWaypoint(waypoint: any, timezoneName: string): GpxWaypoint { // eslint-disable-line @typescript-eslint/no-explicit-any
        const wp = {
            latitude: waypoint._attributes.lat,
            longitude: waypoint._attributes.lon,
            timestamp: DateTime.fromISO(waypoint.time[0]),
            seconds: 0,
            name: waypoint.name[0],
            comment: waypoint.cmt ? waypoint.cmt[0] : '',
            timezoneName,
        } as GpxWaypoint

        if (waypoint.extensions && waypoint.extensions[0]['rangic:begin']) {
            const ext = waypoint.extensions[0]
            const beginTime = DateTime.fromISO(ext['rangic:begin'][0]._attributes.time)
            const finishTime = DateTime.fromISO(ext['rangic:finish'][0]._attributes.time)
            const bounds = {
                minLat: ext['rangic:begin'][0]._attributes.lat,
                minLon: ext['rangic:begin'][0]._attributes.lon,
                maxLat: ext['rangic:finish'][0]._attributes.lat,
                maxLon: ext['rangic:finish'][0]._attributes.lon,
            } as GpxBounds
            wp.rangic = {
                stopType: ext['rangic:stopType'][0],
                description: ext['rangic:description'][0],
                beginLatitude: ext['rangic:begin'][0]._attributes.lat,
                beginLongitude: ext['rangic:begin'][0]._attributes.lon,
                beginTime,
                finishLatitude: ext['rangic:finish'][0]._attributes.lat,
                finishLongitude: ext['rangic:finish'][0]._attributes.lon,
                finishTime,
                seconds: finishTime.diff(beginTime).valueOf() / 1000,
                bounds,
            }
            wp.seconds = wp.rangic.seconds
        }

        return wp
    }

    private processTrack(track: any, skipGapDetection: boolean): GpxTrack { // eslint-disable-line @typescript-eslint/no-explicit-any
        let segmentList: GpxSegment[] = []
        for (const segment of track.trkseg) {
            segmentList = segmentList.concat(this.processSegment(segment, skipGapDetection))
        }

        const t = {
            segments: segmentList,
            kilometers: segmentList.map( (p) => p.kilometers).reduce( (l, r) => l + r),
        } as GpxTrack

        if (track.extensions && track.extensions[0]['rangic:kilometers']) {
            const ext = track.extensions[0]
            t.rangic = {
                kilometers: ext['rangic:kilometers'],
                seconds: ext['rangic:seconds'],
                bounds: this.processBounds(ext['rangic:bounds'][0]),
            }
        }

        return t
    }

    private processSegment(segment: any, skipGapDetection: boolean): GpxSegment[] { // eslint-disable-line @typescript-eslint/no-explicit-any
        const segments: GpxSegment[] = []
        let pointList: GpxPoint[] = []
        let meters = 0.0
        let prevPt: GpxPoint | undefined = undefined

        let rangicSegment: GpxRangicSegmentExtension | undefined
        if (segment.extensions && segment.extensions[0]['rangic:meters']) {
            const ext = segment.extensions[0]
            rangicSegment = {
                kilometers: ext['rangic:meters'][0] * 1000,
                kmh: ext['rangic:kmh'][0],
                seconds: ext['rangic:seconds'][0],
                course: ext['rangic:course'][0],
                bounds: this.processBounds(ext['rangic:bounds'][0]),
                // transportationTypes: this.processTransportationTypes(rangicXml.transportationTypes),
            } as GpxRangicSegmentExtension
        }

        for (const trkpt of segment.trkpt) {
            const gpxPt = this.processPoint(trkpt)
            if (this.minLat === 0) {
                this.minLat = gpxPt.latitude
                this.maxLat = gpxPt.latitude
                this.minLon = gpxPt.longitude
                this.maxLon = gpxPt.longitude
            } else {
                this.minLat = Math.min(gpxPt.latitude, this.minLat)
                this.maxLat = Math.max(gpxPt.latitude, this.maxLat)
                this.minLon = Math.min(gpxPt.longitude, this.minLon)
                this.maxLon = Math.max(gpxPt.longitude, this.maxLon)
            }

            if (prevPt) {
                const secondsDiff = gpxPt.timestamp.diff(prevPt.timestamp).valueOf() / 1000
                if (!skipGapDetection && secondsDiff > 30) {
                    if (pointList.length > 1) {
                        const timezoneName = Timezone.fromGpx(pointList[0])
                        const s = {
                            points: pointList,
                            kilometers: meters / 1000,
                            seconds: pointList.slice(-1)[0].timestamp.diff(pointList[0].timestamp).valueOf() / 1000,
                            timezoneName,
                        } as GpxSegment
                        if (rangicSegment) {
                            s.rangic = rangicSegment
                        }
                        segments.push(s)
                        meters = 0.0
                    }
                    pointList = []
                } else {
                    const metersPrevPt = Geo.distanceGpx(prevPt, gpxPt)
                    gpxPt.calculatedCourse = Geo.bearing(prevPt.latitude, prevPt.longitude, gpxPt.latitude, gpxPt.longitude)
                    gpxPt.calculatedMeters = metersPrevPt
                    gpxPt.calculatedKmh = (metersPrevPt / 1000) / (secondsDiff / (60 * 60))
                    meters += metersPrevPt
                }
            }

            pointList.push(gpxPt)
            prevPt = gpxPt
        }

        if (pointList.length > 0) {
            const timezoneName = Timezone.fromGpx(pointList[0])
            const s = {
                points: pointList,
                kilometers: meters / 1000,
                seconds: pointList.slice(-1)[0].timestamp.diff(pointList[0].timestamp).valueOf() / 1000,
                timezoneName,
            } as GpxSegment
            if (rangicSegment) {
                s.rangic = rangicSegment
            }
            segments.push(s)
        }

        return segments
    }

    private processPoint(trkpt: any): GpxPoint { // eslint-disable-line @typescript-eslint/no-explicit-any
        const pt = {
            latitude: trkpt._attributes.lat,
            longitude: trkpt._attributes.lon,
            elevation: trkpt.ele,
            speed: trkpt.speed,
            course: trkpt.course,
            timestamp: DateTime.fromISO(trkpt.time[0]),
            calculatedMeters: 0,
            calculatedKmh: 0,
        } as GpxPoint

        if (trkpt.extensions && trkpt.extensions[0]['rangic:calculatedMeters']) {
            const ext = trkpt.extensions[0]
            pt.rangic = {
                calculatedMeters: ext['rangic:calculatedMeters'][0],
                calculatedSeconds: ext['rangic:calculatedSeconds'][0],
                calculatedKmh: ext['rangic:calculatedKmh'][0],
                calculatedCourse: ext['rangic:calculatedCourse'][0],
                transportationTypes: [],
            } as GpxRangicPointExtension
        }
        return pt
    }

    private processBounds(bounds: any): GpxBounds { // eslint-disable-line @typescript-eslint/no-explicit-any
        return {
            minLat: bounds._attributes.minLat,
            minLon: bounds._attributes.minLon,
            maxLat: bounds._attributes.maxLat,
            maxLon: bounds._attributes.maxLon,
        }
    }
}
