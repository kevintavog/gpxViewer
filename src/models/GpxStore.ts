import { GpxFile, GpxParser } from '@/models/Gpx'
import { Vue } from 'vue-property-decorator'

export class GpxStore {
    public files: GpxFile[] = []

    public get(name: string): GpxFile | undefined {
      for (let idx = 0; idx < this.files.length; ++idx) {
        if (this.files[idx].name === name) {
          return this.files[idx]
        }
      }
      return undefined
    }

    public add(file: File): Promise<GpxFile> {
      let storeInstance = this
      return new Promise((resolve, reject) => {
        var reader = new FileReader()
        reader.onloadend = (function (file) {
          return function () {
            let xmlString = reader.result as string
            new GpxParser().parse(file.name, xmlString)
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
