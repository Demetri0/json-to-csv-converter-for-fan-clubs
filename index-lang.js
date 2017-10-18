#!/usr/bin/env node
'use strict'

const os    = require("os")
const fs    = require('fs')
const path  = require('path')
const csv   = require('csv')
const fetch = require('node-fetch')
const util  = require('util')


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

const PRETTY_OUT_JSON   = true
const PRETTY_TAB_SIZE   = 2
const IN_FILE_ENCODING  = 'utf8'
const OUT_FILE_ENCODING = 'utf8'
const SYMBOL = {
  COMMA: ',',
  EOL: os.EOL,
  HEADER_LANG_DELIMETER: '-',
  CODES_NESTING_DELIMETER: '_'
}
const FIELD = {
  LOCATION: 'location',
  CODE:     'code',
  LABEL:    'label',
  BRANCHES: 'branches'
}
const HEADER = {
    CODE: 'code',
    TITLE: 'title',
    LOCATION: 'location'
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
  /**
   * Club Initialization. Branches isn't initializing
   * @param  {Object} [club={}] club
   */
  constructor(club = {}){
    this[FIELD.CODE] = club[FIELD.CODE] || ''
    this[FIELD.LABEL] = club[FIELD.LABEL] || ''
    this[FIELD.LOCATION] = club[FIELD.LOCATION] || ''
    this[FIELD.BRANCHES] = {}
  }
  isFirstLevel(){
    return 1 === this[FIELD.CODE].split(SYMBOL.CODES_NESTING_DELIMETER).length
  }
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
  static readHeader(csv){
    let header = csv.splice(0,1)[0]
    let meta = {
      [FIELD.CODE]: 0,
      [FIELD.LOCATION]: {},
      [FIELD.LABEL]: {},

      m_langs: []
    }

    for (var i = 0; i < header.length; i++) {
      let fData = header[i].split(SYMBOL.HEADER_LANG_DELIMETER)
      let fLang = fData[0]
      let fName = ( fData[1] )? fData[1] : fData[0]

      if( ( fName !== fLang ) && ( ! meta.m_langs.includes(fLang) ) ){
        meta.m_langs.push(fLang)
      }

      switch (fName) {
        case HEADER.LOCATION:
          meta[FIELD.LOCATION][fLang] = i; break;
        case HEADER.TITLE:
          meta[FIELD.LABEL][fLang] = i; break;
        case HEADER.CODE:
          meta[FIELD.CODE] = i; break;
        case "":
          continue
        default:
          console.error('[ERROR]', 'Unknown Field', `"${fName}"`, 'in', header)
      }
    }

    return meta
  }
  static readWithNormalize(csv){

  }
  static csv2langJson(csv){
    if( ! (csv instanceof Array) ){
      throw new Exception('(CsvJsonConverter::csv2json) ' + '`csv` must be array')
    }

    let meta = CsvJsonConverter.readHeader(csv)

    let result = {}
    meta.m_langs.forEach(function(lang, i, langs){
      result[lang] = {}
      let map = result[lang]

      csv.forEach(function(club, i, clubs) {
        let _code = club[ meta[FIELD.CODE] ]
        let _title = club[ meta[FIELD.LABEL][lang] ]
        let _loc = club[ meta[FIELD.LOCATION][lang] ]

        let _nestCode = _code.split(SYMBOL.CODES_NESTING_DELIMETER)
        let is1stLevel = _nestCode.length === 1

        let _topCode = undefined
        let _subCode = undefined

        if( ! is1stLevel ){
          _topCode = _nestCode[0]
          _subCode = _nestCode[1]
        }

        if( is1stLevel ){
          map[_code] = {
            [FIELD.CODE]: _code,
            [FIELD.LABEL]: _title,
            [FIELD.LOCATION]: _loc
          }
        } else {
          if( ! map[_topCode][FIELD.BRANCHES] ){
            map[_topCode][FIELD.BRANCHES] = {}
          }
          map[_topCode][FIELD.BRANCHES][_subCode] = {
            [FIELD.CODE]: _subCode,
            [FIELD.LABEL]: _title,
            [FIELD.LOCATION]: _loc
          }
        }
      })

    })

    console.log( util.inspect(result, false, null) )

    // TODO TODO TODO TODOOOO TODODODODOOO

    return result
  }

  static csv2langCsv(csv){
    if( ! (csv instanceof Array) ){
      throw new Exception('(CsvJsonConverter::csv2json) ' + '`csv` must be array')
    }

    let header = csv.splice(0,1)[0]
    let result = []
    let lastClub = csv[0]

    let j_clubs = []

    console.log(csv[0]);

    csv.forEach(function(club, i, clubs){
      let iter = 0
      let is1stLevel = Club.is1stLevel(club)

      if( ! is1stLevel ){
        iter++
      } else {
        lastClub = club
      }

      let clb = [
        club[iter++],
        (is1stLevel)? club[iter] : lastClub[iter-1] + SYMBOL.CODES_NESTING_DELIMETER + club[iter],
        club[++iter]
      ]

      result.push(clb)
    })

    console.log( util.inspect(result, false, null) )

    return result
  }

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

function tt(lines) {
  return lines.map((line) => {
    return line.replace(/^ +/gm, '');
  }).join(' ').trim();
}

class Application {
  constructor(args) {
    this.args  = args
    this.files = this.args.slice(2, this.args.length)
  }

  async runInitOnlineConfig(){
    try {
      console.log('Usage: ./index.js google.online.json')
      await writeTextFile('example.google.online.json', tt`
        {
          \t"BASE_URL": "https://docs.google.com/spreadsheets/d/{key}/gviz/tq?tqx=out:{format}&sheet={sheet}&range={range}&headers={headers}",
          \t"DOC_KEY": "...",
          \t"FORMAT": "csv",
          \t"SHEET": "Sheet1",
          \t"RANGE": "A:D",
          \t"HEADERS": "0"
        }
      `)
      console.log('In current folder was created example config file, '
                  + 'please configure it.');
    } catch (err) {
      console.error(err)
    }
    return 0
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
          data = CsvJsonConverter.csv2langCsv(data)
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
  if(app.args.length === 2){
    app.runInitOnlineConfig()
  } else {
    app.runOnline()
  }
})(process.argv)
