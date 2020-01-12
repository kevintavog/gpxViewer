<template>
  <div class="block">
    <div v-if="isLoading" class="modal-background is-full-page" style="z-index:1001" >
      <div class="progress" >
        <p> Loading ... </p>
        <progress class="progress-bar" />
      </div>
    </div>

    <b-collapse :open.sync="isOpen" class="panel" aria-id="content-id">

      <div slot="trigger" class="panel-heading no-border no-background-color has-text-white" 
           role="button" aria-controls="content-id" >
        <b-icon class="left-padding align-items-inherit" :icon="isOpen ? 'caret-down' : 'caret-up'" />
        <span class="left-padding is-size-4"> {{ headerText }} </span>
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
            <b-table :data="gpxStore.files" >
              <template slot-scope="props">
                <b-table-column field="size" label="" centered>
                  <b-button icon-left="vector-square" size="is-small" @click="sizeToTrack(props.row)" />
                </b-table-column>
                <b-table-column field="name" label="Name" centered>
                  {{ props.row.name }}
                </b-table-column>
                <b-table-column field="distance" label="Distance" centered>
                  {{ displayable.distanceMeters(props.row.meters) }}
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

  </div>
</template>

<script lang="ts">
import { Component, Inject, Prop, Vue, Watch } from 'vue-property-decorator'
import { GpxFile } from '@/models/Gpx'
import { GpxStore } from '@/models/GpxStore'
import { displayable } from '@/models/Displayable'

@Component
export default class Info extends Vue {
  @Inject('gpxStore') private gpxStore!: GpxStore
  @Prop({ required: true }) private message!: string
  private activeTab = 0
  private isOpen = false
  private isLoading = false
  private isAddFileActive = false
  private filesToAdd: File[] = []
  private displayable = displayable

  private mounted() {
    if (this.gpxStore.files.length > 0) {
      this.isOpen = true
    }
  }

  get infoFiles(): string {
    if (this.activeTracks < 1) {
      return ''
    }
    return this.gpxStore.files.map( (f) => f.name ).join(', ')
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
    return this.displayable.distanceKilometers(distance / 1000)
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

  private addTrack(e: Event) {
    this.filesToAdd = []
    this.isAddFileActive = true
    e.stopPropagation()
  }

  private removeTrack(file: GpxFile) {
    this.gpxStore.remove(file)
  }

  private sizeToTrack(file: GpxFile) {
    this.$emit('size-to-track', file.name)
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

</style>
