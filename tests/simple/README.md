# Test Case - Simple

This test case contains two entries: `a.html` and `b.html`.

* They load `a.js` and `b.js` respectively.
* They both load `c.js`.
* The plugin is configured to cache all dependencies of `a.html`

## Parcel Output

* `a.html`
  * `a.js` -> `a.[HASH1].js`
  * `c.js` -> `a.[HASH2].js`
* `b.html`
  * `b.js` -> `b.[HASH3].js`
  * `c.js` -> `a.[HASH2].js`

_<small>[HASH1], [HASH2], and [HASH3] represent the three different hashes Parcel generated</small>_


## Files Cached:

* `a.html`
* `a.[HASH1].js`
* `a.[HASH2].js`