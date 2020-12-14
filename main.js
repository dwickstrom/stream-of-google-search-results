const { fromPromise, of, generate, empty } = require('most')
const most = require('most')
const foldl = require('sanctuary').reduce
const fmap = require('sanctuary').map
const { drop, prop, isJust, trim } = require('sanctuary')
const { compose } = require('ramda')
const puppeteer = require('puppeteer')

const browser = puppeteer.launch({headless: true, slowMo: 25});
const page = browser.then(b => b.newPage());

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

const resultSelector =
  () => [].map.call(document.querySelectorAll('#rso > .g > div > div:nth-child(1) > a'), 
                    e => ({title: e.innerText,href: e.href}))

// initSearch :: String -> Promise {}
const initSearch = term => {
  return new Promise((resolve, reject) => {
    page
      .then(page => page.goto("https://www.google.se")
        .then(() => page.type('input[name="q"]', term))
        .then(() => page.type('input[name="q"]', '\u000d'))
        .then(() => page.waitForSelector('#rso'))
        .then(() => page.waitForTimeout(200))
        .then(() => page.evaluate(resultSelector)))
      .then(resolve)
      .catch(reject)
    })
  }


const nextResults = () => {
  return new Promise((resolve, reject) => {
    page
      .then(page => page.click("#pnnext > span:nth-child(2)")
        .then(() => page.waitForSelector("#rso"))
        .then(() => page.waitForTimeout(200))
        .then(() => page.evaluate(resultSelector)))
      .then(resolve)
      .catch(reject)
  })
}

// terminateSession :: Browser -> Any -> ()
const terminateSession = session => _ =>
    new Promise((resolve, reject) => session
      .then(s => s.close() && resolve())
      .catch(reject))
  

// beginNightmare :: {} -> Stream {}
const traversePages = query =>
  generate(results, query.term)
  .take(query.pages)

// concatArgs :: [String] -> String
const concatArgs =
  foldl(acc => x => `${acc} ${x}`) ('')

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
.chain(traversePages)
.observe(console.log)
.then(terminateSession(browser))
.catch(err => {
  console.log(err)
  browser.then(b => b.close())
})
