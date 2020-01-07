import { GpxFile, GpxParser } from '@/models/Gpx'
import { Vue } from 'vue-property-decorator'
import { displayable } from '@/models/Displayable'

export class GpxStore {
    public files: GpxFile[] = []

    public add(file: File): Promise<GpxFile> {
      let storeInstance = this
      return new Promise((resolve, reject) => {
        var reader = new FileReader()
        reader.onloadend = (function (file) {
          return function () {
            new GpxParser().parse(file.name, reader.result as string)
              .then((gpxFile: GpxFile) => {
                Vue.set(storeInstance.files, storeInstance.files.length, gpxFile)
                resolve(gpxFile)
              })
              .catch((err) => {
                reject(err)
              })
          }
        })(file)
      
        reader.readAsText(file)
      })
    }

    public remove(gpx: GpxFile) {
      let index = this.files.indexOf(gpx)
      if (index >= 0) {
        Vue.delete(this.files, index)
      }
    }
}
