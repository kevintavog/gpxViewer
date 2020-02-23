import { Geo } from '@/models/Geo'
import * as xml2js from 'xml2js'
import { Timezone } from '@/models/Timezone'

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

export interface GpxFile {
    waypoints: GpxWaypoint[]
    tracks: GpxTrack[]
    bounds: GpxTrackBounds
    name: string
    startDate: Date
    endDate: Date
    meters: number
    timezoneName: string
}

export interface GpxWaypoint {
    latitude: number
    longitude: number
    timestamp: Date
    name: string
    visible: boolean
    timezoneName: string
    rangic?: GpxRangicWaypointExtension
}

export interface GpxRangicWaypointExtension {
    stopType: string
    beginLatitude: number
    beginLongitude: number
    beginTime: Date
    finishLatitude: number
    finishLongitude: number
    finishTime: Date
}

export interface GpxTrack {
    segments: GpxSegment[]
    meters: number
}

export interface GpxTrackBounds {
    minLat: number
    minLon: number
    maxLat: number
    maxLon: number
}

export interface GpxSegment {
    points: GpxPoint[]
    meters: number
    bearing: number
    timezoneName: string
    visible: boolean
}

export interface GpxPoint {
    latitude: number
    longitude: number
    timestamp: Date
    calculatedMeters: number
}

export class GpxParser {

    static isFile(o: GpxFile | GpxSegment | GpxWaypoint): o is GpxFile {
        return (o as GpxFile).tracks !== undefined
    }

    static isSegment(o: GpxFile | GpxSegment | GpxWaypoint): o is GpxSegment {
        return (o as GpxSegment).points !== undefined
    }

    static isWaypoint(o: GpxFile | GpxSegment | GpxWaypoint): o is GpxWaypoint {
        return (o as GpxWaypoint).name !== undefined
    }

    static segmentBounds(segment: GpxSegment): GpxTrackBounds {
        var lowLat = segment.points[0].latitude
        var lowLon = segment.points[0].longitude
        var highLat = lowLat
        var highLon = lowLon

        for (const pt of segment.points) {
            lowLat = Math.min(lowLat, pt.latitude)
            lowLon = Math.min(lowLon, pt.longitude)
            highLat = Math.max(highLat, pt.latitude)
            highLon = Math.max(highLon, pt.longitude)
        }

        return { 
            minLat: lowLat,
            minLon: lowLon,
            maxLat: highLat,
            maxLon: highLon
        } as GpxTrackBounds
    }

    minLat: number = 0
    maxLat: number = 0
    minLon: number = 0
    maxLon: number = 0

    public parse(name: string, xml: string): Promise<GpxFile> {
        return new Promise((resolve, reject) => {
            xml2js.parseString(xml, {explicitArray: false}, (error, result) => {
                if (error) {
                    reject(error)
                }

                const trackList: GpxTrack[] = []
                if (Array.isArray(result.gpx.trk)) {
                    for (const track of result.gpx.trk) {
                        trackList.push(this.processTrack(track))
                    }
                } else {
                    // There's a single track, process its segments
                    trackList.push(this.processTrack(result.gpx.trk))
                }

                let timezoneName = trackList[0].segments[0].timezoneName
                const wayPointList: GpxWaypoint[] = []
                if (Array.isArray(result.gpx.wpt)) {
                    for (const wayPoint of result.gpx.wpt) {
                        wayPointList.push(this.processWaypoint(wayPoint, timezoneName))
                    }
                } else if (result.gpx.wpt) {
                    // There's a single waypoint
                    wayPointList.push(this.processWaypoint(result.gpx.wpt, timezoneName))
                }

                const bounds = {
                    maxLat: this.maxLat,
                    minLat: this.minLat,
                    maxLon: this.maxLon,
                    minLon: this.minLon,
                }

                let startDate = trackList[0].segments[0].points[0].timestamp
                let endDate = trackList.slice(-1)[0].segments.slice(-1)[0].points.slice(-1)[0].timestamp
                resolve({
                    waypoints: wayPointList,
                    tracks: trackList,
                    bounds,
                    name: name,
                    startDate: startDate,
                    endDate: endDate,
                    meters: trackList.map( (t) => t.meters).reduce( (l, r) => l + r),
                    timezoneName: timezoneName,
                })
            })
        })
    }

    private processWaypoint(waypoint: any, timezoneName: string): GpxWaypoint {
        var wp = {
            latitude: waypoint.$.lat,
            longitude: waypoint.$.lon,
            timestamp: new Date(waypoint.time),
            name: waypoint.name,
            visible: true,
            timezoneName: timezoneName
        } as GpxWaypoint

        if (waypoint.extensions && waypoint.extensions.rangic) {
            let rangicXml = waypoint.extensions.rangic
            wp.rangic = {
                stopType: rangicXml.$.stopType,
                beginLatitude: rangicXml.begin.$.lat,
                beginLongitude: rangicXml.begin.$.lon,
                beginTime: new Date(rangicXml.begin.$.time),
                finishLatitude: rangicXml.finish.$.lat,
                finishLongitude: rangicXml.finish.$.lon,
                finishTime: new Date(rangicXml.finish.$.time),
            }
        }

        return wp
    }

    private processTrack(track: any): GpxTrack {
        var segmentList: GpxSegment[] = []
        if (Array.isArray(track.trkseg)) {
            for (const segment of track.trkseg) {
                segmentList = segmentList.concat(this.processSegment(segment))
            }
        } else {
            segmentList = segmentList.concat(this.processSegment(track.trkseg))
        }

        return {
            segments: segmentList,
            meters: segmentList.map( (p) => p.meters).reduce( (l, r) => l + r) }
    }

    private processSegment(segment: any): GpxSegment[] {
        const segments: GpxSegment[] = []
        var pointList: GpxPoint[] = []
        var meters = 0.0
        var prevPt: GpxPoint | null = null

        if (Array.isArray(segment.trkpt)) {
            for (const trkpt of segment.trkpt) {
                const gpxPt = {
                    latitude: trkpt.$.lat,
                    longitude: trkpt.$.lon,
                    timestamp: new Date(trkpt.time),
                    calculatedMeters: 0,
                } as GpxPoint
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
                    const secondsDiff = (gpxPt.timestamp.getTime() - prevPt.timestamp.getTime()) / 1000
                    if (secondsDiff > 30) {
                        if (pointList.length > 1) {
                            let timezoneName = Timezone.fromGpx(pointList[0])
                            segments.push({ points: pointList, meters: meters, timezoneName, bearing: -1, visible: true })
                            meters = 0.0
                        }
                        pointList = []
                    } else {
                        let distancePrevPt = Geo.distanceGpx(prevPt, gpxPt)
                        gpxPt.calculatedMeters = distancePrevPt
                        meters += distancePrevPt
                    }
                }

                pointList.push(gpxPt)
                prevPt = gpxPt
            }
        } else {
            let gpxPt = this.processPoint(segment.trkpt)
            if (this.minLat === 0) {
                this.minLat = gpxPt.latitude
                this.maxLat = gpxPt.latitude
                this.minLon = gpxPt.longitude
                this.maxLon = gpxPt.longitude
            }
            pointList.push(gpxPt)
        }

        if (pointList.length > 0) {
            let first = pointList[0]
            let last = pointList.slice(-1)[0]
            let bearing = Geo.bearing(first.latitude, first.longitude, last.latitude, last.longitude)
            let timezoneName = Timezone.fromGpx(pointList[0])
            segments.push({ points: pointList, meters, timezoneName, bearing, visible: true })
        }

        return segments
    }

    private processPoint(trkpt: any): GpxPoint {
        return {
            latitude: trkpt.$.lat,
            longitude: trkpt.$.lon,
            timestamp: new Date(trkpt.time),
            calculatedMeters: 0
        } as GpxPoint
    }

}
