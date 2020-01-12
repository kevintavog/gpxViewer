import { Geo } from '@/models/Geo'
import * as xml2js from 'xml2js'
import { Timezone } from '@/models/Timezone'

/*
<gpx [many attributes] >
    <metadata />
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
    tracks: GpxTrack[]
    bounds: GpxTrackBounds
    name: string
    startDate: Date
    endDate: Date
    meters: number
    timezoneName: string
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
    timezoneName: string
}

export interface GpxPoint {
    latitude: number
    longitude: number
    timestamp: Date
}

export class GpxParser {

/*
    public dates(gpxFile: GpxFile): [Date, Date] {
        let earliestSet = false
        let earliest = new Date()
        let latest = new Date()
        for (const track of gpxFile.tracks) {
            for (const segment of track.segments) {
                if (!earliestSet) {
                    earliest = segment.points[0].timestamp
                    earliestSet = true
                }
                latest = segment.points[segment.points.length - 1].timestamp
            }
        }
        return [earliest, latest]
    }
*/

    public parse(name: string, xml: string): Promise<GpxFile> {
        return new Promise((resolve, reject) => {
            xml2js.parseString(xml, {explicitArray: false}, (error, result) => {
                if (error) {
                    reject(error)
                }

                // Grab bounds: result.gpx.bounds.$.minlat, minlon & so on
                const bounds = {
                    maxLat: Number(result.gpx.bounds.$.maxlat),
                    minLat: Number(result.gpx.bounds.$.minlat),
                    maxLon: Number(result.gpx.bounds.$.maxlon),
                    minLon: Number(result.gpx.bounds.$.minlon),
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

                let startDate = trackList[0].segments[0].points[0].timestamp
                let endDate = trackList.slice(-1)[0].segments.slice(-1)[0].points.slice(-1)[0].timestamp

                resolve({
                    tracks: trackList,
                    bounds,
                    name: name,
                    startDate: startDate,
                    endDate: endDate,
                    meters: trackList.map( (t) => t.meters).reduce( (l, r) => l + r),
                    timezoneName: trackList[0].segments[0].timezoneName,
                })
            })
        })
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
        for (const trkpt of segment.trkpt) {
            const gpxPt = { latitude: trkpt.$.lat, longitude: trkpt.$.lon, timestamp: new Date(trkpt.time) } as GpxPoint
            if (prevPt) {
                const secondsDiff = (gpxPt.timestamp.getTime() - prevPt.timestamp.getTime()) / 1000
                if (secondsDiff > 30) {
                    if (pointList.length > 1) {
                        let timezoneName = Timezone.fromGpx(pointList[0])
                        segments.push({ points: pointList, meters: meters, timezoneName })
                        meters = 0.0
                    }
                    pointList = []
                } else {
                    meters += Geo.distanceGpx(prevPt, gpxPt)
                }
            }
            pointList.push(gpxPt)
            prevPt = gpxPt
        }

        if (pointList.length > 1) {
            let timezoneName = Timezone.fromGpx(pointList[0])
            segments.push({ points: pointList, meters: meters, timezoneName })
        }
        return segments
    }
}
