#Stream of search result pages

This little program will accept a set of command line arguments and then return a stream of Google search results from those concatenated arguments.


## How to
- `yarn install`
- `node main.js sator square`

You can specify how many pages deep you want the crawl, in the `config.json` file.

## Used libraries
- [Nightmare](https://github.com/segmentio/nightmare)
- [Most](https://github.com/cujojs/most/)
- [Sanctuary](https://sanctuary.js.org/)
- [Ramda](http://ramdajs.com/)
