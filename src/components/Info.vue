<template>
  <div class="block">
    <div v-if="isLoading" class="modal-background is-full-page" style="z-index:1001" >
      <div class="progress" >
        <p> Loading ... </p>
        <progress class="progress-bar" />
      </div>
    </div>

    <b-notification v-if="hasErrorMessage"
            type="is-danger"
            :active.sync="hasErrorMessage"
            has-icon
            aria-close-label="Close notification"
            role="alert">
            {{ errorMessage }}
    </b-notification>

    <b-collapse :open.sync="isOpen" class="panel" aria-id="content-id">

      <div slot="trigger" class="panel-heading no-border no-background-color has-text-white" 
           role="button" aria-controls="content-id" >
        <b-icon class="left-padding align-items-inherit" :icon="isOpen ? 'caret-down' : 'caret-up'" />
        <span class="left-padding is-size-4"> {{ headerText }} </span>
        <b-dropdown class="is-pulled-right above-map margin-left" 
            hoverable position="is-top-left" aria-role="list"  >
          <button class="button is-info" slot="trigger">
            <b-icon icon="bars" />
          </button>
          <b-dropdown-item aria-role="list-item" @click="addTrack" >Add a track </b-dropdown-item>
          <b-dropdown-item aria-role="list-item" @click="parseLocationFailed = ''; isGotoLocationActive=true" >Go to lat/lon </b-dropdown-item>
          <b-dropdown-item aria-role="list-item" @click="isAddSquareActive=true" >Add a square </b-dropdown-item>
        </b-dropdown>
        <b-button class="is-pulled-right" icon-left="route" type="is-success" @click="addTrack">Add a track</b-button>
      </div>


      <div v-if="activeTracks > 0" class="track-container" >
        <b-tabs v-model="activeTab" type="is-boxed" vertical>
          <b-tab-item icon="info"  >
            <div class="info-text-content is-size-5">
              <div>
                {{infoFiles}}
              </div>
              <div>
                {{infoDateAndTime}}
              </div>
              <div>
                {{infoDistance}}
              </div>
              <div>
                {{infoDuration}}
              </div>
            </div>
          </b-tab-item>

          <!-- The list of tracks -->
          <b-tab-item icon="route"  >
            <b-table :data="gpxStore.files" :selected.sync="selectedTrack">
              <template slot-scope="props" >
                <b-table-column field="size" label="" centered>
                  <b-button icon-left="vector-square" size="is-small" @click="sizeToBounds(props.row)" />
                </b-table-column>
                <b-table-column field="name" label="Name" centered>
                  {{ props.row.name }}
                </b-table-column>
                <b-table-column field="distance" label="Distance" centered>
                  {{ displayable.yardsString(props.row.meters) }}
                </b-table-column>
                <b-table-column field="date" label="Date" centered>
                  {{ displayable.dayOfWeek(props.row.startDate, props.row.timezoneName) }},
                  {{ displayable.date(props.row.startDate, props.row.timezoneName) }} 
                </b-table-column>
                <b-table-column field="start" label="Start" centered>
                  {{ displayable.shortTime(props.row.startDate, props.row.timezoneName) }},
                  {{ displayable.shortTimezoneName(props.row.timezoneName) }}
                </b-table-column>
                <b-table-column field="end" label="End" centered>
                  {{ displayable.shortTime(props.row.endDate, props.row.timezoneName) }},
                  {{ displayable.shortTimezoneName(props.row.timezoneName) }}
                </b-table-column>
                <b-table-column field="duration" label="Duration" centered>
                  {{ displayable.durationGpx(props.row) }}
                </b-table-column>
                <b-table-column field="remove" label="" centered>
                  <b-button icon-left="trash" type="is-danger" size="is-small" @click="removeTrack(props.row)">Remove</b-button>
                </b-table-column>
              </template>
            </b-table>

          </b-tab-item>

        <!-- Waypoints and segments  -->
          <b-tab-item icon="project-diagram">
            <b-table :data="currentObjects" :selected.sync="selectedObject">
              <template slot-scope="props" >
                <b-table-column field="size" label="C" centered>
                  <b-button icon-left="vector-square" size="is-small" @click="sizeToBounds(props.row)" />
                </b-table-column>
                <b-table-column field="visible" label="V" centered>
                  <span @click="toggleVisibility(props.row)" class="pointer-cursor">
                    <b-icon :icon="props.row.visible ? 'check-square' : 'square'" @click="toggleVisibility(props.row)" />
                  </span>
                </b-table-column>
                <b-table-column field="index" label="Index" centered>
                  {{ props.index + 1 }}
                </b-table-column>
                <b-table-column field="points" label="Type" centered>
                  {{ getObjectType(props.row) }}
                </b-table-column>
                <b-table-column field="start" label="Times" centered>
                  {{ displayable.timeWithSeconds(getStartTime(props.row), gpxStore.files[currentTrackIndex].timezoneName) }} -
                  {{ displayable.timeWithSeconds(getEndTime(props.row), gpxStore.files[currentTrackIndex].timezoneName) }}
                </b-table-column>
                <b-table-column field="start" label="Duration" centered>
                  {{ displayable.secondsToDuration(getSeconds(props.row)) }}
                </b-table-column>
                <b-table-column field="meters" label="Distance" centered>
                  {{ displayable.yardsString(getDistance(props.row)) }}
                </b-table-column>
                <b-table-column field="speed" label="Speed" centered>
                  {{ displayable.speedMph(getSeconds(props.row), getDistance(props.row) / 1000) }}
                </b-table-column>
                <b-table-column field="points" label=" " centered>
                  {{ getExtraInfo(props.row) }}
                </b-table-column>
              </template>
            </b-table>
          </b-tab-item>

        </b-tabs>
      </div>

    </b-collapse>

      <!-- File upload modal -->
      <b-modal :active.sync="isAddFileActive" has-modal-card trap-focus scroll="keep" style="z-index:1000;" >
        <div class="card add-file-card">
          <b-field>
            <b-upload v-model="filesToAdd" multiple drag-drop>
              <section class="section">
                <div class="content has-text-centered">
                  <p>
                    <b-icon icon="upload" size="is-large" />
                  </p>
                  <p>
                    Drop GPX files here or click to select.
                  </p>
                </div>
              </section>
            </b-upload>
          </b-field>

          <div class="tags add-file-tags">
            <span v-for="(file, index) in filesToAdd"
                :key="index"
                class="tag is-primary" >
                {{file.name}}
                <button class="delete is-small"
                    type="button"
                    @click="filesToAdd.splice(index, 1)">
                </button>
            </span>
          </div>

          <div >
            <b-button icon-left="plus" type="is-success" @click="addFiles" :disabled="filesToAdd.length < 1" > Add </b-button>
            <b-button type="is-danger" @click="isAddFileActive = false" class="is-pulled-right" > Cancel </b-button>
          </div>
        </div>
      </b-modal>

      <b-modal :active.sync="isGotoLocationActive" has-modal-card trap-focus scroll="keep" style="z-index:1000;" >
        <div class="card goto-location-card">
          <b-field label="Location" message="lat,lon or Geohash" >
            <b-input v-model="gotoLocationField" />
          </b-field>
          <span v-if="parseLocationFailed.length > 0" class="has-text-danger" >
            {{parseLocationFailed}}
          </span>

          <div >
            <b-button type="is-success" @click="gotoLocation" :disabled="gotoLocationField.length < 1" > Go </b-button>
            <b-button type="is-danger" @click="isGotoLocationActive = false" class="is-pulled-right" > Cancel </b-button>
          </div>
        </div>
      </b-modal>

      <b-modal :active.sync="isAddSquareActive" has-modal-card trap-focus scroll="keep" style="z-index:1000;" >
        <div class="card goto-location-card">
          <b-field label="Location" message="lat,lon OR lat,lon;lat,lon" >
            <b-input v-model="gotoLocationField" />
          </b-field>
          <b-field label="Width/height (meters)" message="The width and height, in meters" >
            <b-input v-model="addSquareWidthField" />
          </b-field>

          <div >
            <b-button  type="is-success" @click="addSquare" 
                  :disabled="gotoLocationField.length < 1" >
              Add
            </b-button>
            <b-button type="is-danger" @click="isAddSquareActive = false" class="is-pulled-right" > Cancel </b-button>
          </div>
        </div>
      </b-modal>

  </div>
</template>

<script lang="ts">
import { Component, Inject, Prop, Vue, Watch } from 'vue-property-decorator'
import { Geo } from '@/models/Geo'
import { GpxFile, GpxParser, GpxSegment, GpxTrackBounds, GpxWaypoint } from '@/models/Gpx'
import { GpxStore } from '@/models/GpxStore'
import { displayable } from '@/models/Displayable'

@Component
export default class Info extends Vue {
  @Inject('gpxStore') private gpxStore!: GpxStore
  @Prop({ required: true }) private message!: string
  @Prop({ required: true }) private currentTrackIndex!: number
  @Prop({ required: true }) private currentSegmentIndex!: number
  private hasErrorMessage = false
  private errorMessage = ''
  private activeTab = 0
  private isOpen = false
  private isLoading = false
  private isAddFileActive = false
  private isGotoLocationActive = false
  private parseLocationFailed = ''
  private isAddSquareActive = false
  private gotoLocationField = ''
  private addSquareWidthField = ''
  private filesToAdd: File[] = []
  private displayable = displayable
  private currentObjects: (GpxSegment | GpxWaypoint)[] = []

  private selectedTrack = Object()
  private selectedObject = Object()

  private mounted() {
    if (this.gpxStore.files.length > 0) {
      this.isOpen = true
      this.onCurrentTrackChanged()
    }
  }

  private sizeToObject(o: GpxSegment | GpxWaypoint) {
    // this.$emit('size-to-track', file.name)
  }

  private getObjectType(o: GpxSegment | GpxWaypoint): string {
    if (GpxParser.isSegment(o)) {
      return "segment"
    }
    if (GpxParser.isWaypoint(o)) {
      return "waypoint"
    }
    return "?"
  }

  private getSeconds(o: GpxSegment | GpxWaypoint): number {
    if (GpxParser.isSegment(o)) {
      return displayable.secondsInSegment(o)
    }
    if (GpxParser.isWaypoint(o)) {
      if (o.rangic) {
        return displayable.durationAsSeconds(o.rangic.beginTime, o.rangic.finishTime)
      }
      return 0
    }
    return -1
  }

  private getDistance(o: GpxSegment | GpxWaypoint): number {
    if (GpxParser.isSegment(o)) {
      return o.meters
    }
    if (GpxParser.isWaypoint(o)) {
      if (o.rangic) {
        return Geo.distanceLL(o.rangic.beginLatitude, o.rangic.beginLongitude, o.rangic.finishLatitude, o.rangic.finishLongitude)
      }
      return 0
    }
    return -1
  }

  private getBearing(o: GpxSegment | GpxWaypoint): number {
    if (GpxParser.isSegment(o)) {
      return o.bearing
    }
    if (GpxParser.isWaypoint(o)) {
      return 0
    }
    return 0
  }

  private getStartTime(o: GpxSegment | GpxWaypoint): Date {
    if (GpxParser.isSegment(o)) {
      return o.points[0].timestamp
    }
    if (GpxParser.isWaypoint(o)) {
      return o.timestamp
    }
    return new Date()
  }

  private getEndTime(o: GpxSegment | GpxWaypoint): Date {
    if (GpxParser.isSegment(o)) {
      return o.points.slice(-1)[0].timestamp
    }
    if (GpxParser.isWaypoint(o)) {
      if (o.rangic) {
        return o.rangic.finishTime
      }
      return o.timestamp
    }
    return new Date()
  }

  private getExtraInfo(o: GpxSegment | GpxWaypoint): string {
    if (GpxParser.isSegment(o)) {
      return `${o.points.length} points`
    }
    if (GpxParser.isWaypoint(o)) {
      if (o.rangic) {
        return o.rangic.stopType
      }
      return o.name
    }
    return ''
  }

  get infoFiles(): string {
    if (this.activeTracks < 1) {
      return ''
    }
    return this.gpxStore.files.map( (f) => f.name ).join(', ')
  }

  @Watch('selectedTrack')
  private onSelectedTrackChanged(to: any, from: any) {
    const file = this.selectedTrack as GpxFile
    let index = 0
    for (const f of this.gpxStore.files) {
      if (f.startDate == file.startDate) { break }
      index += 1
    }

    this.$emit('select-track-index', index)
  }

  @Watch('selectedObject')
  private onSelectedObjectChanged(to: any, from: any) {
    var timestamp: Date = new Date()
    if (GpxParser.isSegment(this.selectedObject)) {
      timestamp = this.selectedObject.points[0].timestamp
      this.$emit('select-segment-time', timestamp.toString())
    } else if (GpxParser.isWaypoint(this.selectedObject)) {
      timestamp = this.selectedObject.timestamp
      this.$emit('select-waypoint-time', timestamp.toString())
    }
  }

  @Watch('currentTrackIndex')
  private onCurrentTrackChanged() {
    this.currentObjects = []
    if (this.currentTrackIndex < 0 || this.currentTrackIndex >= this.gpxStore!.files.length) {
      return
    }

    var newObjects: (GpxSegment | GpxWaypoint)[] = []
    this.gpxStore!.files[this.currentTrackIndex].tracks.forEach( t => {
      t.segments.forEach( s => {
        newObjects.push(s)
      })
    })
    this.gpxStore!.files[this.currentTrackIndex].waypoints.forEach( w => {
      newObjects.push(w)
    })
    this.currentObjects = newObjects.sort( (o1, o2) => {
      return this.getStartTime(o1).getTime() - this.getStartTime(o2).getTime()
    })
    this.currentObjects = newObjects
  }

  @Watch('currentSegmentIndex')
  private onCurrentSegmentChanged() {
    let index = 0
    for (const co of this.currentObjects) {
      if (GpxParser.isSegment(co)) {
        if (index == this.currentSegmentIndex) {
          this.selectedObject = this.currentObjects[index]
        }
      }
    }
  }

  get infoDateAndTime(): string {
    if (this.activeTracks < 1) {
      return ''
    }
    var earliest = this.gpxStore.files[0].startDate
    var latest = this.gpxStore.files[0].endDate
    var earliestTimezoneName = this.gpxStore.files[0].timezoneName
    var latestTimezoneName = earliestTimezoneName
    this.gpxStore.files.forEach( (f) => {
      if (f.startDate < earliest) {
        earliest = f.startDate
        earliestTimezoneName = f.timezoneName
      }
      if (f.endDate > latest) {
        latest = f.endDate
        latestTimezoneName = f.timezoneName
      }
    })

    let earliestDate = this.displayable.date(earliest, earliestTimezoneName)
    let earliestDayOfWeek = this.displayable.dayOfWeek(earliest, earliestTimezoneName)
    let latestDate = this.displayable.date(latest, latestTimezoneName)
    let latestDayOfWeek = this.displayable.dayOfWeek(latest, latestTimezoneName)
    let earliestTime = this.displayable.shortTime(earliest.toISOString(), earliestTimezoneName)
    let latestTime = this.displayable.shortTime(latest.toISOString(), latestTimezoneName)
    if (earliestDate === latestDate) {
      return `${earliestDayOfWeek}, ${earliestDate} ${earliestTime} - ${latestTime}`
    }
    return `${earliestDayOfWeek}, ${earliestDate} ${earliestTime} - ${latestDayOfWeek}, ${latestDate} ${latestTime}`
  }

  get infoDistance(): string {
    if (this.activeTracks < 1) {
      return ''
    }
    let distance = this.gpxStore.files.map( (f) => f.meters).reduce( (accumulator, v) => accumulator + v )
    return this.displayable.milesString(distance / 1000)
  }

  get infoDuration(): string {
    if (this.activeTracks < 1) {
      return ''
    }
    let seconds = this.gpxStore.files
      .map( (f) => this.displayable.durationAsSeconds(f.startDate, f.endDate))
      .reduce( (accumulator, v) => accumulator + v )
    return this.displayable.secondsToDuration(seconds)
  }

  get headerText(): string {
    if (this.activeTracks < 1) {
      return 'No tracks available'
    } else {
      return this.message
    }
  }

  get activeTracks(): Number {
    return this.gpxStore.files.length
  }

  private addSquare(e: Event) {
    this.isAddSquareActive = false
    let list = this.gotoLocationField.split(',').filter( x => x.trim().length).map(Number)
    if (list.length == 2) {
      // The center is given, width must be specified
    } else if (list.length == 4) {
      // Bounding box
      this.$emit('add-rectangle', list)
    }
  }

  private gotoLocation(e: Event) {
    // Validate gotoLocationField; if invalid, don't cancel dialog
    let ll = Geo.parseLatLon(this.gotoLocationField)
    if (ll) {
      this.parseLocationFailed = ''
      this.isGotoLocationActive = false
      this.$emit('goto-location', ll)
    } else {
      this.parseLocationFailed = `Unable to parse '${this.gotoLocationField}'`
    }
  }

  private addTrack(e: Event) {
    this.filesToAdd = []
    this.isAddFileActive = true
    if (e) {
      e.stopPropagation()
    }
  }

  private removeTrack(file: GpxFile) {
    this.gpxStore.remove(file)
  }

  private sizeToBounds(item: GpxFile | GpxSegment | GpxWaypoint) {
    var bounds: GpxTrackBounds = { minLat: 0, minLon: 0, maxLat: 0, maxLon: 0 }
    if (GpxParser.isFile(item)) {
      bounds = item.bounds
    } else if (GpxParser.isSegment(item)) {
      bounds = GpxParser.segmentBounds(item)
    } else if (GpxParser.isWaypoint(item)) {
      bounds.minLat = item.latitude
      bounds.minLon = item.longitude
      bounds.maxLat = item.latitude
      bounds.maxLon = item.longitude
    }

    this.$emit('size-to-bounds', bounds)
  }

  private toggleVisibility(item: GpxSegment | GpxWaypoint) {
    item.visible = !item.visible
    var timestamp: Date
    if (GpxParser.isSegment(item)) {
      timestamp = item.points[0].timestamp
    } else {
      timestamp = item.timestamp
    }
    this.$emit('toggle-visibility', { timestamp: timestamp.toString(), visible: item.visible })
  }

  private addFiles() {
    this.isAddFileActive = false
    this.isLoading = true

    requestAnimationFrame( () => {
      requestAnimationFrame( () => {
        var numberToLoad = this.filesToAdd.length
        this.filesToAdd.forEach((f) => {
          this.gpxStore.add(f)
            .catch((err) => {
              this.errorMessage = err.toString()
              this.hasErrorMessage = true
            })
            .finally( () => {
              numberToLoad -= 1
              if (numberToLoad === 0) {
                this.isLoading = false
              }
            })
        })
      })
    })
  }
}

</script>

<style>

.tab-content {
  max-height: 14em;
  overflow: auto !important;
  background-color: rgba(48, 48, 48, 0.7);
  padding: 0px 0px 0.3em 0px !important;
}

.tabs.is-boxed a:hover {
  background-color: rgba(48, 48, 48, 0.9) !important;
}

.tabs.is-boxed li.is-active a:hover {
  background-color: rgba(48, 48, 48, 0.9) !important;
}

.tabs.is-boxed li.is-active a {
  background-color: rgba(48, 48, 48, 0.7) !important;
}

.table thead th {
  background-color: #303030 !important;
  color: white !important;
}

.table {
  background-color: #303030 !important;
  color: white !important;
}

.b-table .table tr.detail {
  background-color: #606060 !important;
  color: white !important;
}

.panel:not(:last-child) {
  margin-bottom: 0px !important;
}

.dropdown-content {
  background-color: gray !important;
  color: white !important;
}

</style>

<style scoped>

.info-text-content {
  padding-top: 0.5em;
  padding-left: 1em;
}

.track-container {
  max-height: 14em;
  overflow: auto !important;
}

.pointer-cursor {
  cursor: pointer;
}

.left-padding {
  padding-left: 0.5em;
}

.no-border {
  border: 0;
}

.no-background-color {
  background-color: transparent;
}

.align-items-inherit {
  align-items: inherit;
}

.info-panel {
  display: block;
}

.add-file-card {
  padding: 1em;
}

.add-file-tags {
  min-height: 2em;
}

.goto-location-card {
  min-width: 50em;
  padding: 1em;
}

.progress {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  width: 100%;
  text-align: center;
  height: 100%;
}

.progress-bar {
  width: 50%;
}

.above-map {
  z-index: 1001;
}

.menu-dropdown {
  margin-left: 1em;
  background-color: red;
  color: white;
}

.margin-left {
  margin-left: 1em;
}

</style>
