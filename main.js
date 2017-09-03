const Nightmare = require('nightmare')
const { chain, from, fromPromise, of, generate, empty, map, reduce } = require('most')
const most = require('most')
const foldl = require('sanctuary').reduce
const fmap = require('sanctuary').map
const { drop, prop, isJust, trim } = require('sanctuary')
const { compose } = require('ramda')

const nightmare = Nightmare({show: false})

// readFile :: String -> Promise String
const readFile = fileName =>
  new Promise((res, rej) =>
    require('fs').readFile(fileName, 'utf-8', (err, data) =>
      err ? rej(err) : res(data)))

// readFileStream :: String -> Stream String
const readFileStream =
  compose(fromPromise, readFile)

// results :: String -> Stream {}
const results = function* (term) {
  yield initSearch(term)
  while (true)
    yield nextResults()
}

// initSearch :: String -> Promise {}
const initSearch = term => {
  return new Promise((res, rej) => {
    const session = nightmare
    .goto('https://www.google.se')
    .type('input[name="q"]', term)
    .click('#tsf > div.tsf-p > div.jsb > center > input[type="submit"]:nth-child(1)')
    .wait('#resultStats')
    .evaluate(() =>
      [].map.call(
        document.querySelectorAll('.g h3 a'),
        a => ({title: a.innerText, href: a.href})))
    res(session)
  })
}

const nextResults = () => {
  return new Promise((res, rej) => {
    nightmare
    .click('#pnnext > span:nth-child(2)')
    .wait('#resultStats')
    .evaluate(() =>
      [].map.call(
        document.querySelectorAll('.g h3 a'),
        a => ({title: a.innerText, href: a.href})))
      res(nightmare)
  })
}

// wakeUpFrom :: Nightmare -> Any -> Nightmare
const wakeUpFrom = nightmare => res =>
  res && nightmare.end()

// beginNightmare :: {} -> Stream {}
const beginNightmare = query =>
  generate(results, query.term)
  .take(query.pages)

// concatArgs :: [String] -> String
const concatArgs =
  foldl(acc => x => `${acc} ${x}`, '')

// maybeToStream :: Maybe a -> Stream Maybe a
const maybeToStream = m =>
  isJust(m)
  ? of(m.value)
  : empty()

// pluckArgs :: () -> Stream String
const pluckArgs = compose(
  maybeToStream,
  fmap(compose(trim, concatArgs)),
  drop(2)
)

// getConf :: String -> Stream {}
const getConf = file =>
  readFileStream(file)
  .map(JSON.parse)

// buildQuery :: a -> b -> {}
const buildQuery = pages => term =>
  ({pages, term})

// initQuery :: () -> {}
const initQuery = () =>
  of(buildQuery)
  .ap(getConf('config.json').map(prop('pages')))
  .ap(pluckArgs(process.argv))

initQuery()
.chain(beginNightmare)
.observe(console.log)
.then(wakeUpFrom(nightmare), console.error)
