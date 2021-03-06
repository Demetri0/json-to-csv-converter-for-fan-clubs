#!/usr/bin/env node
'use strict'

const os    = require("os")
const fs    = require('fs')
const path  = require('path')
const csv   = require('csv')
const fetch = require('node-fetch')

function makeLinkToDoc(opt) {
  let link = opt.BASE_URL
  link = link.replace('{key}', opt.DOC_KEY)
  link = link.replace('{format}', opt.FORMAT)
  link = link.replace('{sheet}', opt.SHEET)
  link = link.replace('{range}', opt.RANGE)
  link = link.replace('{headers}', opt.HEADERS)
  return link
}

/* EXAMPLE
{
  "BASE_URL": "https://docs.google.com/spreadsheets/d/{key}/gviz/tq?tqx=out:{format}&sheet={sheet}&range={range}&headers={headers}",
  "DOC_KEY": "...",
  "FORMAT": "csv",
  "SHEET": "Sheet1",
  "RANGE": "A:D",
  "HEADERS": "0"
}
//*/

const SYMBOL = {
  COMMA: ',',
  EOL: os.EOL
}

const PRETTY_OUT_JSON   = true
const PRETTY_TAB_SIZE   = 2
const IN_FILE_ENCODING  = 'utf8'
const OUT_FILE_ENCODING = 'utf8'
const FIELD = {
  LOCATION: 'location',
  CODE:     'code',
  LABEL:    'label',
  BRANCHES: 'branches'
}
const HEADER = {
    CODE: 'Code',
    TITLE: 'Title',
    LOCATION: 'Location'
}

class Exception {
  constructor(msg, data = null, name = 'Exception'){
    this.message = msg
    this.name    = name
    this.value   = data
  }
  toString(){
    let msg = `[${this.name}] ${this.message}`
    if(this.value !== null){
      msg += SYMBOL.EOL + JSON.stringify(this.value, null, 2)
    }
    return msg
  }
}

class Club {
  static is1stLevel(csv_club){
    if( (csv_club[0].trim() !== '') || (csv_club[3].trim() === '') ) {
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

    let lastComma = (deep === 0)? SYMBOL.COMMA : ''

    return csv.join(SYMBOL.COMMA) + lastComma + SYMBOL.EOL
  }
  static fromCsv(csv_club){
    let club = {}
    let iter = 0
    if( ! Club.is1stLevel(csv_club) ){
      iter++
    }
    club[FIELD.LOCATION] = csv_club[iter++]
    club[FIELD.CODE] = csv_club[iter++]
    club[FIELD.LABEL] = csv_club[iter++]

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
      if( Club.isEmpty(club) ){
        throw new Exception('One or mere Club field is empty', club, 'EmptyClubException')
      }
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
      if( Club.isEmpty(club) ){
        throw new Exception('One or more Club field is empty', club, 'EmptyClubException')
      }
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

function stripHeader(data){
    return data.filter(function(club){
        return (club.code !== HEADER.CODE) && (club.location !== HEADER.LOCATION) && (club.title !== HEADER.TITLE)
    })
}

class Application {
  constructor(args) {
    this.args  = args
    this.files = this.args.slice(2, this.args.length)
  }

  async runOnline() {
    let googleDoc = await readTextFile(this.files[0])
        googleDoc = JSON.parse(googleDoc)

    let date = (new Date()).toLocaleDateString()
    let outFileName = `[${date}] fan-partner-codes.json`

    try {
      let link = makeLinkToDoc(googleDoc)
      let data = await fetch(link)
          data = await data.buffer()
          data = data.toString()
          data = await parseCsv(data)
          data = CsvJsonConverter.csv2json(data)
          data = stripHeader(data)
          data = JSON.stringify(data, null, PRETTY_TAB_SIZE * PRETTY_OUT_JSON)
      await writeTextFile(outFileName, data)
      // console.log(data)
    } catch(err) {
      console.error(err)
    }
  }

  async run() {
    try {
      for(let file of this.files){
        let data = await readTextFile(file)
        let outFileName = file
            outFileName = outFileName.replace(/\.csv$/, '')
            outFileName = outFileName.replace(/\.json$/, '')

        if( /.+\.csv$/.test(file) ){
          let date = (new Date()).toLocaleDateString()
          outFileName = `[${date}] ${outFileName}.json`
          data = await parseCsv(data)
          data = CsvJsonConverter.csv2json(data)
          data = stripHeader(data)
          data = JSON.stringify(data, null, PRETTY_TAB_SIZE * PRETTY_OUT_JSON)

        } else if( /.+\.json$/.test(file) ){
          outFilename = outFileName + '.csv'
          data = JSON.parse(data)
          data = CsvJsonConverter.json2csv(data)

        } else {
          console.log('Unrecognized file extension')
          return false
        }

        await writeTextFile(outFileName, data)
        // console.log(data)
        return true
      }
    } catch(e){
      console.log(e)
    }
  }
}

(function main(args){
  let app = new Application(args)
  app.runOnline()
})(process.argv)
