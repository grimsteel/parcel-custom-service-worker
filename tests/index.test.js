import { describe } from "mocha";
import { assertCachedFileContents, removeDistDirectory } from "./utils.js";

describe("The service worker should cache", () => {
  beforeEach(async () => {
    await removeDistDirectory();
  });

  it("a specific file and all of its dependencies (simple)", () => assertCachedFileContents("simple", ['a.html', 'b.html'], ['a.html', 'a.js', 'c.js']));
  it("only the specified files (exact)", () => assertCachedFileContents("exact", ['a.html'], ['a.html', 'c.js']));
  it(
    "a specific file and it dependencies even if they contain inlined bundles (bundle-inlining)",
    () => assertCachedFileContents("bundle-inlining", ['a.html', 'b.html'], ['a.html', 'a.js', 'common.js'])
  );
  it("a code-splitted npm module (npm-module)", () => assertCachedFileContents("npm-module", ['a.html', 'b.html'], [
    'a.html',
    'a.js',
    '../../../node_modules/@faker-js/faker/dist/esm/index.mjs',
    '../../../node_modules/@faker-js/faker/dist/esm/chunk-\\w+.mjs'
  ]));
  it("all the files if the configuration is not provided (no-config)", () => assertCachedFileContents("no-config", ['a.html', 'b.html'], ['a.html', 'a.js', 'b.html', 'b.js', 'c.js']));
});