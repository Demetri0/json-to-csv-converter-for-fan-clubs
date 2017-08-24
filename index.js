'use strict'

const os   = require("os")
const fs   = require('fs')
const path = require('path')
const csv  = require('csv')

const IN_FILE_ENCODING = 'utf8'
const OUT_FILE_ENCODING = 'utf8'
const FIELD = {
  LOCATION: 'location',
  CODE:     'code',
  LABEL:    'label',
  BRANCHES: 'branches'
}

class Exception {
  constructor(msg, data = null){
    this.message = msg
    this.name    = 'Exception'
    this.value   = data
  }
  toString(){
    let msg = `[${this.name}] ${this.message}`
    if(this.value != null){
      msg += '\n' + JSON.stringify(this.value, null, 2)
    }
    return msg
  }
}

class Club {
  static toCsv(club, deep = 0){
    let csv = []

    for(let i = 0; i < deep; ++i){
      csv.push('')
    }

    csv.push(club[FIELD.LOCATION])
    csv.push(club[FIELD.CODE])
    csv.push(club[FIELD.LABEL])

    return csv.join(',') + os.EOL
  }
  static isEmpty(club){
    if( ! club[FIELD.LOCATION].trim().length ) return true
    if( ! club[FIELD.CODE].trim().length ) return true
    if( ! club[FIELD.LABEL].trim().length ) return true
    return false
  }
}

class CsvJsonConverter {
  static csv2json(csv){
    if( ! (json instanceof Array) ){
      throw new Exception('(CsvJsonConverter::csv2json) ' + '`csv` must be array')
    }
    return null
  }
  static json2csv(json, deep = 0){
    if( ! (json instanceof Array) ){
      throw new Exception('(CsvJsonConverter::json2csv) ' + '`json` must be array')
    }

    let csv  = ''

    for(let club of json){
      csv += Club.toCsv(club, deep)
      if( !! club[FIELD.BRANCHES] ){
        csv += CsvJsonConverter.json2csv(club[FIELD.BRANCHES], deep+1)
      }
    }

    return csv
  }
}

function readTextFile(filename){
  return new Promise((resolve,reject)=>{
    fs.readFile(filename, IN_FILE_ENCODING, (err, data)=>{
      if(err){
        reject(err, filename)
      } else {
        resolve(data, filename)
      }
    })
  })
}

function writeTextFile(filename, data){
  return new Promise((resolve,reject)=>{
    fs.writeFile(filename, data, OUT_FILE_ENCODING, (err, data)=>{
      if(err){
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

class Application {
  constructor(args){
    this.args  = args
    this.files = this.args.slice(2, this.args.length)
  }

  async run(){
    try {
      for(let file of this.files){
        let data = await readTextFile(file)
            data = JSON.parse(data)
            data = await CsvJsonConverter.json2csv(data)
            await writeTextFile(file+'.csv', data)
            console.log(data)
      }
    } catch(e){
      console.log(e)
    }
  }
}

(function main(args){
  let app = new Application(args)
  app.run()
})(process.argv)
