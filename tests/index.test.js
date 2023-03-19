import { describe } from "mocha";
import { assertCachedFileContents, removeDistDirectory } from "./utils.js";

describe("The service worker should cache", () => {
  beforeEach(async () => {
    await removeDistDirectory();
  });

  it("the exact files specified (simple)", async () => {
    await assertCachedFileContents("simple", ['a.html', 'b.html'], ['a.html', 'a.js', 'c.js', 'b.js']);
  });
});