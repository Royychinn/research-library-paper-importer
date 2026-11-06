const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const pickerOptions = [];
const pickers = [];
const loadListeners = [];
const input = { value: "" };
const window = {
  document: {
    getElementById: () => input,
    addEventListener(type, listener, capture) {
      loadListeners.push({ type, listener, capture });
    }
  }
};

// Zotero 10 FilePicker uses string paths, including displayDirectory, file and files.
class FilePicker {
  constructor() {
    assert(pickerOptions.length, "Unexpected file picker");
    this.options = pickerOptions.shift();
    this.returnOK = 0;
    this.returnCancel = 1;
    this.modeOpen = 0;
    this.modeOpenMultiple = 3;
    this.modeGetFolder = 2;
    this.filterAll = 1;
    pickers.push(this);
  }

  init(window, title, mode) {
    this.window = window;
    this.mode = mode;
  }

  appendFilters() {}

  set displayDirectory(value) {
    assert.equal(typeof value, "string", "displayDirectory requires a path string");
    this.directory = value;
  }

  get displayDirectory() {
    return this.directory;
  }

  async show() {
    return this.options.cancel ? this.returnCancel : this.returnOK;
  }

  get file() {
    assert(!this.options.cancel, "Cancelled picker must not read file");
    return this.options.file;
  }

  get files() {
    assert(!this.options.cancel, "Cancelled picker must not read files");
    return this.options.files;
  }
}

const context = {
  window,
  ChromeUtils: { importESModule: () => ({ FilePicker }) },
  Zotero: { File: { pathToFile: (value) => ({ path: value }) } }
};
vm.createContext(context);
for (const filename of ["paper-importer.js", "chrome/content/settings.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, filename), "utf8"), context, { filename });
}
const plugin = context.ResearchLibraryPaperImporter;
const settings = context.ResearchLibraryPaperImporterSettings;
settings.window = window;
plugin.config.defaultInboxDir = "D:\\资料库\\New_Papers";

function nextPicker(options) {
  pickerOptions.push(options);
}

function assertDirectory(expected) {
  assert.equal(pickers.at(-1).displayDirectory, expected,
    "Default directory must be set even when the implementation catches setter errors");
}

const tests = [
  ["settings initializes from its script scope on the pane's captured load", async () => {
    assert.equal(loadListeners.length, 1);
    const { type, listener, capture } = loadListeners[0];
    assert.equal(type, "load");
    assert.equal(capture, true);
    const originalInit = settings.init;
    let initializedWindow = null;
    settings.init = (value) => { initializedWindow = value; };
    try {
      listener({ target: { id: "another-pane" } });
      assert.equal(initializedWindow, null);
      listener({ target: { id: "zotero-prefpane-research-library-paper-importer" } });
      assert.equal(initializedWindow, window);
    } finally {
      settings.init = originalInit;
    }
  }],
  ["pickFolder preserves its default directory and returns a string path", async () => {
    nextPicker({ file: "D:\\选择\\Article" });
    assert.equal(await plugin.pickFolder(window), "D:\\选择\\Article");
    assertDirectory(plugin.config.defaultInboxDir);
  }],
  ["pickFiles preserves its default directory and accepts string arrays", async () => {
    const files = ["D:\\选择\\article.pdf", "D:\\选择\\supplement.xlsx"];
    nextPicker({ files });
    assert.deepEqual(Array.from(await plugin.pickFiles(window)), files);
    assertDirectory(plugin.config.defaultInboxDir);
  }],
  ["browseFolder trims the default directory and accepts a string result", async () => {
    input.value = "  D:\\资料库\\Papers  ";
    nextPicker({ file: "D:\\选择\\Papers" });
    await settings.browseFolder("destinationDir");
    assert.equal(input.value, "D:\\选择\\Papers");
    assertDirectory("D:\\资料库\\Papers");
  }],
  ["browseFile starts in the file's parent directory and accepts a string result", async () => {
    input.value = "  D:\\资料库\\config\\tags.json  ";
    nextPicker({ file: "D:\\选择\\new-tags.json" });
    await settings.browseFile("tagDictionaryPath");
    assert.equal(input.value, "D:\\选择\\new-tags.json");
    assertDirectory("D:\\资料库\\config");
  }],
  ["pickFolder cancellation returns null", async () => {
    nextPicker({ cancel: true });
    assert.equal(await plugin.pickFolder(window), null);
  }],
  ["pickFiles cancellation returns null", async () => {
    nextPicker({ cancel: true });
    assert.equal(await plugin.pickFiles(window), null);
  }],
  ["browseFolder cancellation preserves the current setting", async () => {
    input.value = "D:\\保留\\Papers";
    nextPicker({ cancel: true });
    await settings.browseFolder("destinationDir");
    assert.equal(input.value, "D:\\保留\\Papers");
  }],
  ["browseFile cancellation preserves the current setting", async () => {
    input.value = "D:\\保留\\tags.json";
    nextPicker({ cancel: true });
    await settings.browseFile("tagDictionaryPath");
    assert.equal(input.value, "D:\\保留\\tags.json");
  }]
];

async function main() {
  let failures = 0;
  for (const [name, test] of tests) {
    try {
      await test();
      console.log(`PASS ${name}`);
    } catch (error) {
      failures++;
      console.error(`FAIL ${name}: ${error.message}`);
    }
  }
  assert.equal(pickerOptions.length, 0, "All configured pickers must be used");
  assert.equal(failures, 0, `${failures} file-picker test(s) failed`);
  console.log("file-picker tests passed");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
