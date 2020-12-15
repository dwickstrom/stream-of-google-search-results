import { Stream } from "./node_modules/most/type-definitions/most"
import { Browser } from "./node_modules/@types/puppeteer/index"

const { fromPromise, of, generate, empty } = require('most')
const foldl = require('sanctuary').reduce
const fmap = require('sanctuary').map
const { drop, prop, isJust, trim } = require('sanctuary')
const { compose } = require('ramda')
const puppeteer = require('puppeteer')

const browser: Promise<Browser> = 
    puppeteer.launch({headless: false, slowMo: 25});

const page = browser.then(b => b.newPage());

const readFile: (fileName: string) => Promise<string> = 
    (fileName: string) =>
        new Promise((resolve, reject) =>
            require('fs')
                .readFile(fileName, 
                          'utf-8', 
                          (err: unknown, data: string) => 
                            err 
                                ? reject(err) 
                                : resolve(data)))

const readFileStream: (fileName: string) => Stream<string> =
    compose(fromPromise, readFile)

type Query = 
    { term: string
    , pages: number }

type SearchResult = 
    { title: string
    , href: string }

type SearchResultPage = Array<SearchResult>

const results: 
    (term: string) => 
        Generator<Promise<SearchResultPage>, never, unknown> =
            function* (term: string) {
                yield initSearch(term)
                while (true)
                    yield nextResults()
            }

const resultSelector =
    () => 
        [].map.call(document.querySelectorAll('#rso > .g > div > div:nth-child(1) > a'), 
                    (e: any) => ({title: e.innerText,href: e.href}))

const initSearch: (term: string) => Promise<SearchResultPage> = 
    (term: string) => 
        new Promise((resolve, reject) => 
            page.then(page => page.goto("https://www.google.se")
                    .then(() => page.type('input[name="q"]', term))
                    .then(() => page.type('input[name="q"]', '\u000d'))
                    .then(() => page.waitForSelector('#rso'))
                    .then(() => page.waitForTimeout(300))
                    .then(() => page.evaluate(resultSelector)))
                .then((r: unknown) => resolve(r as SearchResultPage))
                .catch(reject))
    


const nextResults: () => Promise<SearchResultPage> = 
    () => 
        new Promise((resolve, reject) => 
            page.then(page => page.click("#pnnext > span:nth-child(2)")
                    .then(() => page.waitForSelector("#rso"))
                    .then(() => page.waitForTimeout(300))
                    .then(() => page.evaluate(resultSelector)))
                .then((r: unknown) => resolve(r as SearchResultPage))
                .catch(reject))


const terminateSession = (browser: Promise<Browser>) => (_: SearchResultPage) =>
    new Promise((resolve, reject) => 
        browser
            .then((s: Browser) => s.close())
            .then(() => console.log(_))
            .then(() => resolve())
            .catch(reject))


const traversePages: (query: Query) => Stream<SearchResultPage> = 
    (query: Query) =>
        generate(results, query.term)
            .take(query.pages)

const concatArgs: (args: string[]) => string =
  foldl((acc: string) => (x: string) => `${acc} ${x}`) ('')

const maybeToStream: (m: any) => Stream<any> = 
    (m: any) =>
        isJust(m)
            ? of(m.value)
            : empty()

const pluckArgs: (args: string[]) => Stream<Array<string>> = 
    compose(
        maybeToStream,
        fmap(compose(trim, concatArgs)),
        drop(2))

const getConf: (file: string) => Stream<SearchResultPage> = 
    (file: string) =>
        readFileStream(file)
        .map(JSON.parse)

const buildQuery: (pages: number) => (term: string) => Query = 
    (pages: number) => 
        (term: string) => ({pages, term})

const initQuery: () => Stream<Query> = 
    () =>
        of(buildQuery)
            .ap(getConf('config.json').map(prop('pages')))
            .ap(pluckArgs(process.argv))

initQuery()
    .flatMap(traversePages)
    .observe(console.log)
    .then(terminateSession(browser))
    .catch((err: any) => {
        console.log(err)
        browser.then((b: Browser) => b.close())
    })
