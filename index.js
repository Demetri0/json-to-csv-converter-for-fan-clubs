'use strict'

const os   = require("os")
const fs   = require('fs')
const path = require('path')
const csv  = require('csv')

const COMMA = ','
const PRETTY_OUT_JSON   = true
const PRETTY_TAB_SIZE   = 4
const IN_FILE_ENCODING  = 'utf8'
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
  static is1stLevel(csv_club){
    if( csv_club[0].trim() !== '' ) {
      return true
    }
    return false
  }
  static toCsv(club, deep = 0){
    let csv = []

    for(let i = 0; i < deep; ++i){
      csv.push('')
    }

    csv.push(club[FIELD.LOCATION])
    csv.push(club[FIELD.CODE])
    csv.push(club[FIELD.LABEL])

    let lastComma = (deep === 0)? ',' : ''

    return csv.join(COMMA) + lastComma + os.EOL
  }
  static fromCsv(csv_club){
    let club = {}
    let iter = 0
    if( Club.is1stLevel(csv_club) ){
      iter++
    }
    club[FIELD.LOCATION] = csv_club[iter++]
    club[FIELD.LABEL] = csv_club[iter++]
    club[FIELD.CODE] = csv_club[iter++]

    return club
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
    if( ! (csv instanceof Array) ){
      throw new Exception('(CsvJsonConverter::csv2json) ' + '`csv` must be array')
    }

    let json = []
    let lastClub = {}

    for (let csv_club of csv) {
      let club = Club.fromCsv(csv_club)
      if( Club.is1stLevel(csv_club) ){
        json.push(club)
        lastClub = club
      } else {
        if( typeof lastClub[FIELD.BRANCHES] === 'undefined' ){
          lastClub[FIELD.BRANCHES] = []
        }
        lastClub[FIELD.BRANCHES].push(club)
      }
    }

    return json
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

function parseCsv(data){
  return new Promise((resolve,reject)=>{
    csv.parse(data, (err, data)=>{
      if(err){
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
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
        let outFilename = file

        if( /.+\.csv$/.test(file) ){
          outFilename = outFilename + '.json'
          data = await parseCsv(data)
          data = CsvJsonConverter.csv2json(data)
          data = JSON.stringify(data, null, PRETTY_TAB_SIZE * PRETTY_OUT_JSON)

        } else if( /.+\.json$/.test(file) ){
          outFilename = outFilename + '.csv'
          data = JSON.parse(data)
          data = CsvJsonConverter.json2csv(data)

        } else {
          console.log('Unrecognized file extension')
          return false
        }

        await writeTextFile(outFilename, data)
        console.log(data)
        return true
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
