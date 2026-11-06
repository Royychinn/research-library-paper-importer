var { FilePicker: ResearchLibraryFilePicker } = ChromeUtils.importESModule("chrome://zotero/content/modules/filePicker.mjs");

var ResearchLibraryPaperImporterSettings = {
  window: null,
  initRetries: 0,

  init(window) {
    this.window = window;
    if (!this.$("rl-defaultInboxDir")) {
      if (this.initRetries++ < 20) {
        window.setTimeout(() => this.init(window), 50);
      }
      return;
    }
    this.initRetries = 0;
    this.populate();
    this.bind();
  },

  plugin() {
    return Zotero.ResearchLibraryPaperImporter;
  },

  bind() {
    const root = this.$("zotero-prefpane-research-library-paper-importer");
    if (root?._researchLibraryImporterBound) return;
    if (root) root._researchLibraryImporterBound = true;
    for (const key of ["defaultInboxDir", "destinationDir", "importedDir", "logsDir"]) {
      this.$(`rl-browse-${key}`)?.addEventListener("command", () => this.browseFolder(key));
    }
    this.$("rl-browse-tagDictionaryPath")?.addEventListener("command", () => this.browseFile("tagDictionaryPath"));
    this.$("rl-save-settings")?.addEventListener("command", () => this.save());
    this.$("rl-reload-settings")?.addEventListener("command", () => this.populate());
  },

  populate() {
    const plugin = this.plugin();
    if (!plugin) {
      Services.prompt.alert(this.window, "Research Library Importer", "The importer plugin is not loaded.");
      return;
    }
    const settings = plugin.getSettingsSnapshot();
    for (const key of ["defaultInboxDir", "destinationDir", "importedDir", "logsDir", "tagDictionaryPath"]) {
      this.$(`rl-${key}`).value = settings[key] || "";
    }
    this.$("rl-filenameTitleWordLimit").value = String(settings.filenameTitleWordLimit || 14);
    this.$("rl-moveCompletedFolders").checked = !!settings.moveCompletedFolders;
  },

  values() {
    return {
      defaultInboxDir: this.$("rl-defaultInboxDir").value,
      destinationDir: this.$("rl-destinationDir").value,
      importedDir: this.$("rl-importedDir").value,
      logsDir: this.$("rl-logsDir").value,
      tagDictionaryPath: this.$("rl-tagDictionaryPath").value,
      filenameTitleWordLimit: this.$("rl-filenameTitleWordLimit").value,
      moveCompletedFolders: this.$("rl-moveCompletedFolders").checked
    };
  },

  save() {
    const plugin = this.plugin();
    if (!plugin) return;
    plugin.applySettings(this.values());
    this.populate();
    Services.prompt.alert(this.window, "Research Library Importer", "Settings saved.");
  },

  async browseFolder(key) {
    const fp = new ResearchLibraryFilePicker();
    fp.init(this.window, "Select folder", fp.modeGetFolder);
    this.setDisplayDirectory(fp, this.$(`rl-${key}`).value, false);
    if ((await fp.show()) !== fp.returnOK) return;
    this.$(`rl-${key}`).value = this.pathFromPickerFile(fp.file);
  },

  async browseFile(key) {
    const fp = new ResearchLibraryFilePicker();
    fp.init(this.window, "Select JSON file", fp.modeOpen);
    fp.appendFilters(fp.filterAll);
    this.setDisplayDirectory(fp, this.$(`rl-${key}`).value, true);
    if ((await fp.show()) !== fp.returnOK) return;
    this.$(`rl-${key}`).value = this.pathFromPickerFile(fp.file);
  },

  setDisplayDirectory(fp, path, filePath) {
    try {
      let dir = String(path || "").trim();
      if (filePath) dir = dir.replace(/[\\\/][^\\\/]*$/, "");
      if (dir) fp.displayDirectory = dir;
    } catch (e) {}
  },

  pathFromPickerFile(file) {
    if (!file) return "";
    if (typeof file === "string") return file;
    return file.path || String(file);
  },

  $(id) {
    return this.window.document.getElementById(id);
  }
};

// Preference scripts run in a sandbox; initialize from that scope on pane load.
window.document.addEventListener("load", (event) => {
  if (event.target?.id === "zotero-prefpane-research-library-paper-importer") {
    ResearchLibraryPaperImporterSettings.init(window);
  }
}, true);
