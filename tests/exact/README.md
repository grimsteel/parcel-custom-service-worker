# Test Case - Exact

This test case contains one entry: `a.html`.

* It loads `a.js` and `c.js`
* The plugin is configured to cache `a.html` and `c.js`

## Parcel Output

* `a.html`
  * `a.js` -> `a.[HASH1].js`
  * `c.js` -> `a.[HASH2].js`

_<small>[HASH1], and [HASH2] represent the three different hashes Parcel generated</small>_


## Files Cached:

* `a.html`
* `a.[HASH2].js`