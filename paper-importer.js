var { FilePicker } = ChromeUtils.importESModule("chrome://zotero/content/modules/filePicker.mjs");

ResearchLibraryPaperImporter = {
  id: null,
  version: null,
  rootURI: null,
  prefPrefix: "extensions.researchLibraryPaperImporter.",
  activeOperation: "",
  config: {
    destinationDir: "D:\\Research_Library\\01_Papers",
    defaultInboxDir: "D:\\Research_Library\\00_Inbox\\New_Papers",
    importedDir: "D:\\Research_Library\\00_Inbox\\Imported",
    logsDir: "D:\\Research_Library\\04_Workspace\\tools\\zotero_paper_importer_plugin\\logs",
    tagDictionaryPath: "D:\\Research_Library\\04_Workspace\\tools\\paper_importer\\tag_dictionary.json",
    stagingPrefix: "IMPORT_",
    filenameTitleWordLimit: 14,
    moveCompletedFolders: true,
    sidecarExtensions: [".pdf", ".caj", ".zip", ".xlsx", ".xls", ".csv", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".gif", ".webp", ".docx", ".pptx", ".txt", ".md", ".json", ".xml", ".html", ".htm", ".ris", ".bib", ".m", ".r", ".py"],
    sidecarKeywords: ["supplement", "supplementary", "supplemental", "suppl", "suppinfo", "supporting", "appendix", "appendices", "additional", "online resource", "esm", "moesm", "mmc", "data sheet", "figure", "fig", "highres", "high-res", "source", "data", "dataset", "table", "code", "graphical", "si", "s1", "s2", "s001", "图", "表", "补充", "附件", "附录", "补充信息", "支持信息", "高清"]
  },
  defaultTagDictionary: {
    MDD: ["MDD", "major depressive disorder", "major depression", "depression"],
    PLS: ["PLS", "partial least squares"],
    IVFC: ["IVFC", "interindividual variability in functional connectivity", "individual variability in functional connectivity"],
    gratitude: ["gratitude", "grateful", "gratefulness"],
    reciprocity: ["reciprocity", "reciprocal"],
    fMRI: ["fMRI", "functional magnetic resonance imaging", "functional MRI"],
    CPM: ["CPM", "connectome-based predictive modeling", "connectome based predictive modeling"],
    CCA: ["CCA", "canonical correlation analysis"],
    HMM: ["HMM", "hidden Markov model"],
    ISC: ["ISC", "intersubject correlation", "inter-subject correlation"],
    ISFC: ["ISFC", "intersubject functional correlation", "inter-subject functional correlation"],
    normative: ["normative modeling", "normative model", "normative"],
    ML: ["machine learning", "deep learning", "random forest", "support vector machine", "SVM"]
  },

  init({ id, version, rootURI }) {
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
    this.applyPlatformDefaults();
    this.loadSettings();
    this.repairRequiredSettings();
    Zotero.ResearchLibraryPaperImporter = this;
    this.registerPreferencePane();
  },

  shutdown() {
    if (Zotero.ResearchLibraryPaperImporter === this) {
      delete Zotero.ResearchLibraryPaperImporter;
    }
  },

  applyPlatformDefaults() {
    Object.assign(this.config, this.platformDefaultConfig());
  },

  platformDefaultConfig() {
    const base = this.defaultLibraryRoot();
    return {
      destinationDir: this.joinPath(base, "01_Papers"),
      defaultInboxDir: this.joinPath(base, this.joinPath("00_Inbox", "New_Papers")),
      importedDir: this.joinPath(base, this.joinPath("00_Inbox", "Imported")),
      logsDir: this.joinPath(base, this.joinPath("04_Workspace", this.joinPath("tools", this.joinPath("zotero_paper_importer_plugin", "logs")))),
      tagDictionaryPath: this.joinPath(base, this.joinPath("04_Workspace", this.joinPath("tools", this.joinPath("paper_importer", "tag_dictionary.json"))))
    };
  },

  defaultLibraryRoot() {
    if (this.isWindows()) return "D:\\Research_Library";
    try {
      const home = Services.dirsvc.get("Home", Ci.nsIFile).path;
      if (home) return this.joinPath(home, "Research_Library");
    } catch (e) {}
    return "Research_Library";
  },

  isWindows() {
    try {
      return Services.appinfo.OS === "WINNT";
    } catch (e) {
      return true;
    }
  },

  pathSeparator() {
    return this.isWindows() ? "\\" : "/";
  },

  joinPath(...parts) {
    const sep = this.pathSeparator();
    const clean = parts
      .filter((part) => part !== null && part !== undefined && String(part) !== "")
      .map((part, index) => {
        let s = String(part);
        if (index > 0) s = s.replace(/^[\\\/]+/, "");
        if (index < parts.length - 1) s = s.replace(/[\\\/]+$/, "");
        return s;
      });
    return clean.join(sep);
  },

  registerPreferencePane() {
    try {
      if (!Zotero.PreferencePanes?.register) return;
      Zotero.PreferencePanes.register({
        id: "zotero-prefpane-research-library-paper-importer",
        pluginID: this.id,
        label: "Research Library Importer",
        image: "chrome://researchlibrarypaperimporter/content/icons/favicon.svg",
        src: "chrome://researchlibrarypaperimporter/content/settings.xhtml",
        scripts: ["chrome://researchlibrarypaperimporter/content/settings.js"]
      });
    } catch (e) {
      Zotero.logError(e);
    }
  },

  addToWindow(window) {
    const doc = window.document;
    const menu = doc.getElementById("menu_ToolsPopup") || doc.getElementById("menu_toolsPopup");
    if (!menu || doc.getElementById("research-library-paper-importer-menu-inbox")) {
      return;
    }

    const separator = doc.createXULElement("menuseparator");
    separator.id = "research-library-paper-importer-separator";
    menu.appendChild(separator);

    this.appendMenuItem(doc, menu, "research-library-paper-importer-menu-inbox", "Research Library: Import New_Papers Inbox", () => this.runExclusive(window, "Inbox import", () => this.importInbox(window)));
    this.appendMenuItem(doc, menu, "research-library-paper-importer-menu-folder", "Research Library: Import Article Folder...", () => this.runExclusive(window, "Folder import", () => this.pickFolderAndImport(window)));
    this.appendMenuItem(doc, menu, "research-library-paper-importer-menu-files", "Research Library: Import Files as One Article...", () => this.runExclusive(window, "File import", () => this.pickFilesAndImport(window)));
    this.appendMenuItem(doc, menu, "research-library-paper-importer-menu-attach-files", "Research Library: Attach Files to Selected Item...", () => this.runExclusive(window, "Supplement attach", () => this.pickFilesAndAttachToSelected(window)));
    this.appendMenuItem(doc, menu, "research-library-paper-importer-menu-attach-folder", "Research Library: Attach Folder to Selected Item...", () => this.runExclusive(window, "Supplement attach", () => this.pickFolderAndAttachToSelected(window)));
    this.appendMenuItem(doc, menu, "research-library-paper-importer-menu-rebuild-files", "Research Library: Rebuild Article from Existing Files...", () => this.runExclusive(window, "Article rebuild", () => this.pickFilesAndRebuildArticle(window)));
    this.appendMenuItem(doc, menu, "research-library-paper-importer-menu-rebuild-folder", "Research Library: Rebuild Article from Existing Folder...", () => this.runExclusive(window, "Article rebuild", () => this.pickFolderAndRebuildArticle(window)));
    this.appendMenuItem(doc, menu, "research-library-paper-importer-menu-rename-attachments", "Research Library: Rename Selected Item Attachments...", () => this.runExclusive(window, "Attachment rename", () => this.renameSelectedItemAttachments(window)));

    const separator2 = doc.createXULElement("menuseparator");
    separator2.id = "research-library-paper-importer-separator-2";
    menu.appendChild(separator2);

    this.appendMenuItem(doc, menu, "research-library-paper-importer-menu-settings", "Research Library: Settings...", () => this.showSettings(window));
    this.appendMenuItem(doc, menu, "research-library-paper-importer-menu-last-log", "Research Library: Show Last Import / Undo Info", () => this.showLastImportInfo(window));
  },

  appendMenuItem(doc, menu, id, label, handler) {
    const item = doc.createXULElement("menuitem");
    item.id = id;
    item.setAttribute("label", label);
    item.addEventListener("command", handler);
    menu.appendChild(item);
  },

  async runExclusive(window, label, task) {
    if (this.activeOperation) {
      this.alert(window, "Research Library Importer", `Another operation is still running: ${this.activeOperation}`);
      return;
    }
    this.activeOperation = label;
    try {
      return await task();
    } finally {
      this.activeOperation = "";
    }
  },

  addToAllWindows() {
    for (const win of Zotero.getMainWindows()) {
      if (win.ZoteroPane) this.addToWindow(win);
    }
  },

  removeFromWindow(window) {
    const doc = window.document;
    for (const id of [
      "research-library-paper-importer-menu-inbox",
      "research-library-paper-importer-menu-folder",
      "research-library-paper-importer-menu-files",
      "research-library-paper-importer-menu-attach-files",
      "research-library-paper-importer-menu-attach-folder",
      "research-library-paper-importer-menu-rebuild-files",
      "research-library-paper-importer-menu-rebuild-folder",
      "research-library-paper-importer-menu-rename-attachments",
      "research-library-paper-importer-menu-settings",
      "research-library-paper-importer-menu-last-log",
      "research-library-paper-importer-separator",
      "research-library-paper-importer-separator-2"
    ]) {
      doc.getElementById(id)?.remove();
    }
  },

  removeFromAllWindows() {
    for (const win of Zotero.getMainWindows()) {
      if (win.ZoteroPane) this.removeFromWindow(win);
    }
  },

  async importInbox(window) {
    try {
      const plans = this.planInbox();
      await this.runPlansWithPreview(window, plans, "inbox");
    } catch (e) {
      this.handleError(window, e);
    }
  },

  async pickFolderAndImport(window) {
    try {
      const folder = await this.pickFolder(window);
      if (!folder) return;
      await this.runPlansWithPreview(window, [this.planArticleFolder(folder)], "folder");
    } catch (e) {
      this.handleError(window, e);
    }
  },

  async pickFilesAndImport(window) {
    try {
      const files = await this.pickFiles(window);
      if (!files || !files.length) return;
      await this.runPlansWithPreview(window, [this.planArticle(files, "Selected files", null, [])], "files");
    } catch (e) {
      this.handleError(window, e);
    }
  },

  async pickFilesAndAttachToSelected(window) {
    try {
      const parent = this.getSelectedParentItem(window);
      const files = await this.pickFiles(window);
      if (!files || !files.length) return;
      await this.attachSupplementPathsWithPreview(window, parent, files, []);
    } catch (e) {
      this.handleError(window, e);
    }
  },

  async pickFolderAndAttachToSelected(window) {
    try {
      const parent = this.getSelectedParentItem(window);
      const folder = await this.pickFolder(window);
      if (!folder) return;
      const collected = this.collectDirectSupportedFiles(folder);
      await this.attachSupplementPathsWithPreview(window, parent, collected.files, collected.ignored);
    } catch (e) {
      this.handleError(window, e);
    }
  },

  async pickFilesAndRebuildArticle(window) {
    try {
      const files = await this.pickFiles(window);
      if (!files || !files.length) return;
      await this.rebuildArticleWithPreview(window, this.planArticle(files, "Rebuilt article", null, []), "rebuild_files");
    } catch (e) {
      this.handleError(window, e);
    }
  },

  async pickFolderAndRebuildArticle(window) {
    try {
      const folder = await this.pickFolder(window);
      if (!folder) return;
      const collected = this.collectDirectSupportedFiles(folder);
      const articleName = this.leafName(folder);
      await this.rebuildArticleWithPreview(window, this.planArticle(collected.files, articleName, folder, collected.ignored), "rebuild_folder");
    } catch (e) {
      this.handleError(window, e);
    }
  },

  async pickFolder(window) {
    const fp = new FilePicker();
    fp.init(window, "Select one article folder", fp.modeGetFolder);
    try {
      fp.displayDirectory = Zotero.File.pathToFile(this.config.defaultInboxDir);
    } catch (e) {}
    if ((await fp.show()) !== fp.returnOK) return null;
    return this.pathFromPickerFile(fp.file);
  },

  async pickFiles(window) {
    const fp = new FilePicker();
    fp.init(window, "Select files for one article", fp.modeOpenMultiple);
    fp.appendFilters(fp.filterAll);
    try {
      fp.displayDirectory = Zotero.File.pathToFile(this.config.defaultInboxDir);
    } catch (e) {}
    if ((await fp.show()) !== fp.returnOK) return null;
    return Array.from(fp.files || []).map((file) => this.pathFromPickerFile(file)).filter(Boolean);
  },

  pathFromPickerFile(file) {
    if (!file) return "";
    if (typeof file === "string") return file;
    return file.path || String(file);
  },

  getSelectedParentItem(window) {
    const selected = window.ZoteroPane?.getSelectedItems?.() || [];
    for (const item of selected) {
      if (item?.isRegularItem?.()) return item;
      if (item?.isAttachment?.() && item.parentItem?.isRegularItem?.()) return item.parentItem;
    }
    throw new Error("Please select one existing Zotero item first, then attach supplementary files.");
  },

  getSelectedParentItems(window) {
    const selected = window.ZoteroPane?.getSelectedItems?.() || [];
    const seen = new Set();
    const parents = [];
    for (const item of selected) {
      let parent = null;
      if (item?.isRegularItem?.()) {
        parent = item;
      } else if (item?.isAttachment?.() && item.parentItem?.isRegularItem?.()) {
        parent = item.parentItem;
      }
      if (!parent || seen.has(parent.id)) continue;
      seen.add(parent.id);
      parents.push(parent);
    }
    if (!parents.length) {
      throw new Error("Please select one or more Zotero items or their attachments first.");
    }
    return parents;
  },

  async renameSelectedItemAttachments(window) {
    try {
      const parents = this.getSelectedParentItems(window);
      const prepared = [];
      for (const parent of parents) {
        prepared.push({
          parent,
          ...(await this.fileAttachmentInfos(parent))
        });
      }

      const totalAttachments = prepared.reduce((n, row) => n + row.attachments.length, 0);
      const totalSkipped = prepared.reduce((n, row) => n + row.skipped.length, 0);
      const preview = [
        `Selected Zotero items: ${prepared.length}`,
        `File attachments to check: ${totalAttachments}`,
        `Missing/non-file attachments skipped: ${totalSkipped}`,
        "",
        "Preview:"
      ];
      for (const row of prepared.slice(0, 12)) {
        preview.push(`- ${row.parent.getField("title") || row.parent.key}: ${row.attachments.length} file attachments`);
      }
      if (prepared.length > 12) preview.push(`... plus ${prepared.length - 12} more items`);

      if (!totalAttachments) {
        this.alert(window, "Research Library Rename Attachments", preview.join("\n"));
        return;
      }
      if (!Services.prompt.confirm(window, "Research Library Rename Attachments", preview.join("\n") + "\n\nProceed?")) {
        return;
      }

      const runLog = this.newRunLog("rename_selected_attachments", []);
      const totals = { renamed: 0, unchanged: 0, failed: 0, skipped: totalSkipped };
      await this.writeRunLog(runLog);
      for (const row of prepared) {
        const result = await this.renameAttachmentsForItem(row.parent, row.attachments, row.skipped);
        totals.renamed += result.renamed;
        totals.unchanged += result.unchanged;
        totals.failed += result.failed;
        runLog.records.push(result.logRecord);
        await this.writeRunLog(runLog);
      }
      const logPath = await this.writeRunLog(runLog);

      this.alert(window, "Research Library Rename Attachments", [
        `Selected Zotero items: ${prepared.length}`,
        `Renamed files: ${totals.renamed}`,
        `Already correct/unchanged: ${totals.unchanged}`,
        `Skipped missing/non-file: ${totals.skipped}`,
        `Failed: ${totals.failed}`,
        "",
        `Log: ${logPath}`
      ].join("\n"));
    } catch (e) {
      this.handleError(window, e);
    }
  },

  async fileAttachmentInfos(parent) {
    const attachments = [];
    const skipped = [];
    const ids = parent.getAttachments?.() || [];
    for (const id of ids) {
      const item = Zotero.Items.get(id);
      if (!item || item.deleted || !item.isAttachment?.()) continue;

      let path = "";
      try {
        path = item.getFilePath?.() || "";
      } catch (e) {
        skipped.push({ attachmentKey: item.key || "", attachmentID: item.id || "", reason: "no_local_file_path" });
        continue;
      }
      if (!path) {
        skipped.push({ attachmentKey: item.key || "", attachmentID: item.id || "", reason: "no_local_file_path" });
        continue;
      }

      let file = null;
      try {
        file = Zotero.File.pathToFile(path);
        if (!file.exists() || !file.isFile()) {
          skipped.push({ attachmentKey: item.key || "", attachmentID: item.id || "", path, reason: "file_missing" });
          continue;
        }
      } catch (e) {
        skipped.push({ attachmentKey: item.key || "", attachmentID: item.id || "", path, reason: "file_missing" });
        continue;
      }

      attachments.push({
        item,
        path,
        filename: item.attachmentFilename || file.leafName || this.leafName(path),
        size: file.fileSize || 0
      });
    }
    return { attachments, skipped };
  },

  async renameAttachmentsForItem(parent, attachments, skipped) {
    const primary = this.pickPrimaryAttachmentForRename(attachments);
    const ordered = [...attachments].sort((a, b) => {
      if (primary && a.item.id === primary.item.id) return -1;
      if (primary && b.item.id === primary.item.id) return 1;
      return String(a.filename).localeCompare(String(b.filename));
    });
    const counters = {};
    const records = [];
    let renamed = 0;
    let unchanged = 0;
    let failed = 0;

    for (const info of ordered) {
      const isPrimary = primary && info.item.id === primary.item.id;
      const beforePath = info.item.getFilePath?.() || info.path;
      const beforeName = this.leafName(beforePath) || info.filename;
      const desiredName = isPrimary
        ? this.makePrimaryFileName(parent, info.item)
        : this.makeSidecarFileName(parent, info.filename || beforeName, counters);
      try {
        const changed = await info.item.renameAttachmentFile(desiredName, { unique: true, updateTitle: true });
        const afterPath = info.item.getFilePath?.() || beforePath;
        const afterName = this.leafName(afterPath) || desiredName;
        if (changed === true || beforeName !== afterName) {
          renamed++;
        } else {
          unchanged++;
        }
        records.push({
          attachmentKey: info.item.key || "",
          attachmentID: info.item.id || "",
          kind: isPrimary ? "Primary" : this.sidecarKind(info.filename || beforeName),
          beforePath,
          afterPath,
          desiredName,
          status: beforeName === afterName ? "unchanged" : "renamed"
        });
      } catch (e) {
        failed++;
        records.push({
          attachmentKey: info.item.key || "",
          attachmentID: info.item.id || "",
          kind: isPrimary ? "Primary" : this.sidecarKind(info.filename || beforeName),
          beforePath,
          desiredName,
          status: "error",
          error: String(e)
        });
      }
    }

    const logRecord = {
      articleName: parent.getField("title") || parent.key,
      status: "renamed_attachments",
      itemKey: parent.key,
      itemID: parent.id,
      renamed,
      unchanged,
      failed,
      skipped: skipped || [],
      attachments: records
    };
    return { renamed, unchanged, failed, skipped: skipped || [], logRecord };
  },

  pickPrimaryAttachmentForRename(attachments) {
    const pdfs = attachments.filter((info) => this.ext(info.filename || info.path) === ".pdf");
    if (!pdfs.length) return null;
    const nonSidecarPdfs = pdfs.filter((info) => !this.isSidecarName(info.filename || info.path));
    const pool = nonSidecarPdfs.length ? nonSidecarPdfs : pdfs;
    return [...pool].sort((a, b) => (b.size || 0) - (a.size || 0))[0] || null;
  },

  collectDirectSupportedFiles(folderPath) {
    const folder = Zotero.File.pathToFile(folderPath);
    const files = [];
    const ignored = [];
    if (!folder.exists() || !folder.isDirectory()) {
      return { files, ignored: [folderPath] };
    }

    const entries = folder.directoryEntries;
    while (entries.hasMoreElements()) {
      const entry = entries.getNext().QueryInterface(Ci.nsIFile);
      if (entry.isDirectory()) {
        ignored.push(entry.path);
        continue;
      }
      if (!entry.isFile()) continue;
      if (this.config.sidecarExtensions.includes(this.ext(entry.leafName))) {
        files.push(entry.path);
      } else {
        ignored.push(entry.path);
      }
    }
    return { files, ignored };
  },

  planInbox() {
    const inbox = Zotero.File.pathToFile(this.config.defaultInboxDir);
    if (!inbox.exists() || !inbox.isDirectory()) {
      throw new Error("Inbox folder does not exist: " + this.config.defaultInboxDir);
    }

    const plans = [];
    const rootPdfs = [];
    const rootNonPdfFiles = [];
    const rootIgnored = [];
    const entries = inbox.directoryEntries;
    while (entries.hasMoreElements()) {
      const entry = entries.getNext().QueryInterface(Ci.nsIFile);
      if (entry.isDirectory()) {
        plans.push(this.planArticleFolder(entry.path));
      } else if (entry.isFile()) {
        const extension = this.ext(entry.leafName);
        if (extension === ".pdf") {
          rootPdfs.push(entry.path);
        } else if (this.config.sidecarExtensions.includes(extension)) {
          rootNonPdfFiles.push(entry.path);
        } else {
          rootIgnored.push(entry.path);
        }
      }
    }
    for (const pdfPath of rootPdfs) {
      const articleName = this.stripExtension(this.leafName(pdfPath));
      plans.push(this.planArticle([pdfPath], articleName, null, []));
    }
    if (rootNonPdfFiles.length || rootIgnored.length) {
      const looseFiles = this.planArticle([], "Loose non-PDF files in inbox", null, [...rootNonPdfFiles, ...rootIgnored]);
      looseFiles.error = "Loose non-PDF files cannot be assigned to an article. Put them in that article's folder.";
      plans.push(looseFiles);
    }
    return plans.sort((a, b) => String(a.articleName).localeCompare(String(b.articleName)));
  },

  planArticleFolder(folderPath) {
    const folder = Zotero.File.pathToFile(folderPath);
    if (!folder.exists() || !folder.isDirectory()) {
      return { articleName: this.leafName(folderPath), folderPath, sourcePaths: [], sidecarPaths: [], ignored: [], error: "Selected path is not a folder." };
    }

    const files = [];
    const ignored = [];
    const entries = folder.directoryEntries;
    while (entries.hasMoreElements()) {
      const entry = entries.getNext().QueryInterface(Ci.nsIFile);
      if (entry.isDirectory()) {
        ignored.push(entry.path);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!this.config.sidecarExtensions.includes(this.ext(entry.leafName))) {
        ignored.push(entry.path);
        continue;
      }
      files.push(entry.path);
    }
    return this.planArticle(files, folder.leafName, folder.path, ignored);
  },

  planArticle(sourcePaths, articleName, folderPath, ignored) {
    const cleanPaths = [...new Set(sourcePaths.filter(Boolean))];
    const plan = {
      articleName,
      folderPath,
      sourcePaths: cleanPaths,
      sidecarPaths: [],
      ignored: ignored || [],
      error: "",
      duplicate: null,
      primaryPath: "",
      primarySelectionNote: ""
    };

    if (!cleanPaths.length) {
      plan.error = "No supported files found.";
      return plan;
    }

    const picked = this.pickPrimary(cleanPaths);
    if (picked.error) {
      plan.error = picked.error;
      return plan;
    }
    plan.primaryPath = picked.primary;
    plan.primarySelectionNote = picked.note || "";
    plan.sidecarPaths = cleanPaths.filter((path) => this.normalizePath(path) !== this.normalizePath(plan.primaryPath));
    return plan;
  },

  pickPrimary(paths) {
    const pdfs = paths.filter((path) => this.ext(path) === ".pdf");
    if (!pdfs.length) return { error: "No main PDF found." };

    const candidates = pdfs.filter((path) => !this.isSidecarName(path));
    if (candidates.length === 1) return { primary: candidates[0] };

    const pool = candidates.length ? candidates : pdfs;
    const primary = [...pool].sort((a, b) => this.fileSize(b) - this.fileSize(a))[0];
    if (!primary) return { error: "No main PDF found." };
    return {
      primary,
      note: `Multiple PDFs found; selected largest PDF as main: ${this.leafName(primary)}`
    };
  },

  async runPlansWithPreview(window, plans, mode) {
    if (!plans.length) {
      this.alert(window, "Research Library Importer", "No article folders or files found.");
      return;
    }

    const prepared = await this.preparePlans(plans);
    const ready = prepared.filter((plan) => !plan.error && !plan.duplicate);
    if (!this.confirmPlans(window, prepared, mode)) return;

    const runLog = this.newRunLog(mode, prepared);
    const results = [];
    for (const plan of prepared) {
      if (plan.error || plan.duplicate) {
        runLog.records.push(this.skippedLogRecord(plan));
        continue;
      }
      try {
        const result = await this.executePlan(plan, { runLog });
        results.push(result);
      } catch (e) {
        Zotero.logError(e);
        if (!e?.researchLibraryLogged) {
          runLog.records.push({
            articleName: plan.articleName,
            status: "error",
            error: String(e),
            sourcePaths: plan.sourcePaths
          });
        }
      }
    }

    const logPath = await this.writeRunLog(runLog);
    this.alert(window, "Research Library Importer", this.formatBatchResult(prepared, ready, results, logPath));
  },

  async attachSupplementPathsWithPreview(window, parent, sourcePaths, ignored) {
    const supported = [];
    const ignoredAll = [...(ignored || [])];
    for (const path of sourcePaths) {
      if (this.config.sidecarExtensions.includes(this.ext(path))) {
        supported.push(path);
      } else {
        ignoredAll.push(path);
      }
    }

    if (!supported.length) {
      this.alert(window, "Research Library Importer", "No supported supplementary files found.");
      return;
    }

    const linkedPaths = new Set((await this.existingLinkedFilePaths()).map((path) => this.normalizePath(path)));
    const toAttach = [];
    const skipped = [];
    for (const path of supported) {
      if (linkedPaths.has(this.normalizePath(path))) {
        skipped.push({ path, reason: "already_linked_same_path" });
      } else {
        toAttach.push(path);
      }
    }

    const preview = [
      `Target item: ${parent.getField("title") || parent.key}`,
      `Files to attach: ${toAttach.length}`,
      `Already linked/skipped: ${skipped.length}`,
      `Ignored unsupported/direct folders: ${ignoredAll.length}`,
      "",
      "Preview:"
    ];
    for (const path of toAttach.slice(0, 12)) {
      preview.push(`- ${this.sidecarKind(path)}: ${this.leafName(path)}`);
    }
    if (toAttach.length > 12) preview.push(`... plus ${toAttach.length - 12} more files`);

    if (!toAttach.length) {
      this.alert(window, "Research Library Supplement Attach", preview.join("\n"));
      return;
    }
    if (!Services.prompt.confirm(window, "Research Library Supplement Attach", preview.join("\n") + "\n\nProceed?")) {
      return;
    }

    const runLog = this.newRunLog("attach_supplement_to_selected", []);
    const plan = {
      articleName: parent.getField("title") || parent.key,
      sourcePaths: toAttach
    };
    const logRecord = await this.startOperationRecord(runLog, plan);
    const moved = [];
    const attached = [];
    const createdItems = [];
    const fileBindings = new Map();
    try {
      for (const sourcePath of toAttach) {
        const file = await this.moveToDestination(sourcePath);
        moved.push(file);
        this.recordMove(logRecord, file);
        await this.writeRunLog(runLog);
      }

      const counters = {};
      let renamed = 0;
      for (const file of moved) {
        const item = await Zotero.Attachments.linkFromFile({
          file: file.path,
          parentItemID: parent.id,
          title: this.leafName(file.path)
        });
        createdItems.push(item);
        fileBindings.set(file, item);
        this.recordCreatedItem(logRecord, item, "sidecar_attachment");
        await this.writeRunLog(runLog);

        const sidecarName = this.makeSidecarFileName(parent, file.originalFilename || this.leafName(file.path), counters);
        if ((await item.renameAttachmentFile(sidecarName, { unique: true, updateTitle: false })) === true) {
          renamed++;
        }
        this.updateMovedPath(file, item);
        attached.push({ item, source: file });
        await this.writeRunLog(runLog);
      }

      Object.assign(logRecord, {
        status: "attached_to_existing",
        itemKey: parent.key,
        itemID: parent.id,
        sidecars: attached.map((pair) => this.fileLog(pair.source, pair.item)),
        skipped,
        ignored: ignoredAll,
        renamed
      });
      const logPath = await this.writeRunLog(runLog);

      this.alert(window, "Research Library Supplement Attach", [
        `Target item: ${parent.getField("title") || parent.key}`,
        `Attached files: ${attached.length}`,
        `Renamed files: ${renamed}`,
        `Skipped existing: ${skipped.length}`,
        `Ignored: ${ignoredAll.length}`,
        "",
        `Log: ${logPath}`
      ].join("\n"));
    } catch (e) {
      logRecord.error = String(e);
      await this.rollbackOperation(runLog, logRecord, createdItems, moved, fileBindings);
      const error = e instanceof Error ? e : new Error(String(e));
      error.researchLibraryLogged = true;
      throw error;
    }
  },

  async rebuildArticleWithPreview(window, plan, mode) {
    if (plan.error) {
      this.alert(window, "Research Library Rebuild Article", plan.error);
      return;
    }

    const existingPaths = new Set((await this.existingLinkedFilePaths()).map((path) => this.normalizePath(path)));
    const alreadyLinked = plan.sourcePaths.filter((path) => existingPaths.has(this.normalizePath(path)));
    const preview = [
      `Mode: ${mode}`,
      `Article name: ${plan.articleName}`,
      `Main PDF: ${this.leafName(plan.primaryPath)}`,
      `Attachments: ${plan.sidecarPaths.length}`,
      `Already linked elsewhere: ${alreadyLinked.length}`,
      `Ignored: ${(plan.ignored || []).length}`,
      "",
      "This repair mode ignores duplicate checks and creates a new Zotero item.",
      "It does not delete old wrong Zotero items. You can delete those manually after checking the new item.",
      "",
      "Attachments:"
    ];
    for (const path of plan.sidecarPaths.slice(0, 12)) {
      preview.push(`- ${this.sidecarKind(path)}: ${this.leafName(path)}`);
    }
    if (plan.sidecarPaths.length > 12) preview.push(`... plus ${plan.sidecarPaths.length - 12} more files`);

    if (!Services.prompt.confirm(window, "Research Library Rebuild Article", preview.join("\n") + "\n\nProceed?")) {
      return;
    }

    const runLog = this.newRunLog(mode, [plan]);
    try {
      const result = await this.executePlan(plan, {
        allowAlreadyLinkedSidecars: true,
        archiveFolder: false,
        logStatus: "rebuilt_existing",
        runLog
      });
      const logPath = await this.writeRunLog(runLog);
      this.alert(window, "Research Library Rebuild Article", [
        `Created item: ${result.title}`,
        `Attached sidecars: ${result.sidecars}`,
        `Renamed files: ${result.renamed}`,
        `Metadata recognized: ${result.recognized === false ? "No, marked needs_review" : "Yes"}`,
        "",
        `Log: ${logPath}`
      ].join("\n"));
    } catch (e) {
      Zotero.logError(e);
      if (!e?.researchLibraryLogged) {
        runLog.records.push({
          articleName: plan.articleName,
          status: "error",
          error: String(e),
          sourcePaths: plan.sourcePaths
        });
      }
      const logPath = await this.writeRunLog(runLog);
      this.alert(window, "Research Library Rebuild Article Error", `${e}\n\nLog: ${logPath}`);
    }
  },

  async preparePlans(plans) {
    const linkedPaths = new Set((await this.existingLinkedFilePaths()).map((path) => this.normalizePath(path)));
    const hashIndex = await this.buildExistingPdfIndex();
    const hashCache = new Map();
    const incomingPdfs = new Map();

    for (const plan of plans) {
      if (plan.error || !plan.primaryPath) continue;
      if (linkedPaths.has(this.normalizePath(plan.primaryPath))) {
        plan.duplicate = { reason: "already_linked_same_path", path: plan.primaryPath };
        continue;
      }
      const duplicate = await this.findDuplicatePdf(plan.primaryPath, hashIndex, hashCache);
      if (duplicate && linkedPaths.has(this.normalizePath(duplicate.path))) {
        plan.duplicate = { ...duplicate, reason: "already_linked_same_sha256" };
        continue;
      }

      const size = this.fileSize(plan.primaryPath);
      const hash = await this.sha256Cached(plan.primaryPath, hashCache);
      if (!hash) continue;
      const key = `${size}:${hash}`;
      if (incomingPdfs.has(key)) {
        plan.duplicate = {
          reason: "same_batch_sha256_pdf",
          path: incomingPdfs.get(key),
          sha256: hash
        };
      } else {
        if (duplicate) {
          plan.reuseExistingPath = duplicate.path;
          const note = `Exact PDF already exists on disk; reuse existing PDF: ${duplicate.path}. Inbox copy will remain unchanged.`;
          plan.primarySelectionNote = [plan.primarySelectionNote, note].filter(Boolean).join(" ");
        }
        incomingPdfs.set(key, plan.reuseExistingPath || plan.primaryPath);
      }
    }
    return plans;
  },

  confirmPlans(window, plans, mode) {
    const ready = plans.filter((plan) => !plan.error && !plan.duplicate);
    const duplicates = plans.filter((plan) => plan.duplicate);
    const errors = plans.filter((plan) => plan.error);
    const ignored = plans.reduce((n, plan) => n + (plan.ignored ? plan.ignored.length : 0), 0);
    const compact = (value, maxLength) => {
      const text = String(value || "").replace(/\s+/g, " ").trim();
      const characters = Array.from(text);
      return characters.length <= maxLength
        ? text
        : characters.slice(0, Math.max(1, maxLength - 1)).join("") + "…";
    };
    const readyLimit = 5;
    const issueLimit = 2;

    const lines = [
      `Mode: ${mode}`,
      `Ready articles: ${ready.length}`,
      `Duplicate/known PDFs skipped: ${duplicates.length}`,
      `Needs review/errors: ${errors.length}`,
      `Ignored direct items/folders: ${ignored}`,
      "",
      "Preview:"
    ];

    for (const plan of ready.slice(0, readyLimit)) {
      let note = "";
      if (plan.reuseExistingPath) {
        note = " | reuse";
      } else if (plan.primarySelectionNote) {
        note = ` | note: ${compact(plan.primarySelectionNote, 18)}`;
      }
      lines.push(`- ${compact(plan.articleName, 24)} | main: ${compact(this.leafName(plan.primaryPath), 24)} | attachments: ${plan.sidecarPaths.length}${note}`);
    }
    if (ready.length > readyLimit) lines.push(`... plus ${ready.length - readyLimit} more ready articles`);
    for (const plan of duplicates.slice(0, issueLimit)) {
      lines.push(`- duplicate: ${compact(plan.articleName, 28)} -> ${compact(this.leafName(plan.duplicate.path), 28)}`);
    }
    if (duplicates.length > issueLimit) lines.push(`... plus ${duplicates.length - issueLimit} more duplicates`);
    for (const plan of errors.slice(0, issueLimit)) {
      lines.push(`- needs review: ${compact(plan.articleName, 28)} -> ${compact(plan.error, 36)}`);
    }
    if (errors.length > issueLimit) lines.push(`... plus ${errors.length - issueLimit} more errors`);

    if (!ready.length) {
      this.alert(window, "Research Library Import Preview", lines.join("\n"));
      return false;
    }
    return Services.prompt.confirm(window, "Research Library Import Preview", lines.join("\n") + "\n\nProceed?");
  },

  async executePlan(plan, options = {}) {
    const linkedPaths = new Set((await this.existingLinkedFilePaths()).map((path) => this.normalizePath(path)));
    const runLog = options.runLog || this.newRunLog(options.logStatus || "import", [plan]);
    const logRecord = await this.startOperationRecord(runLog, plan);
    const moved = [];
    const createdItems = [];
    const fileBindings = new Map();
    try {
      for (const sourcePath of plan.sourcePaths) {
        let file;
        if (plan.reuseExistingPath
            && this.normalizePath(sourcePath) === this.normalizePath(plan.primaryPath)) {
          const existing = Zotero.File.pathToFile(plan.reuseExistingPath);
          if (!existing.exists() || !existing.isFile()) {
            throw new Error("Existing duplicate PDF disappeared before import: " + plan.reuseExistingPath);
          }
          file = {
            originalPath: sourcePath,
            path: existing.path,
            currentPath: existing.path,
            originalFilename: existing.leafName,
            moved: false,
            reusedExisting: true
          };
        } else {
          file = await this.moveToDestination(sourcePath);
        }
        moved.push(file);
        this.recordMove(logRecord, file);
        await this.writeRunLog(runLog);
      }

      const primary = moved.find((x) => this.normalizePath(x.originalPath) === this.normalizePath(plan.primaryPath));
      if (!primary) throw new Error("Primary PDF disappeared during import.");

      const sidecars = moved.filter((x) => x !== primary);
      const attachment = await Zotero.Attachments.linkFromFile({
        file: primary.path,
        title: this.leafName(primary.path)
      });
      createdItems.push(attachment);
      fileBindings.set(primary, attachment);
      this.recordCreatedItem(logRecord, attachment, "primary_attachment");
      await this.writeRunLog(runLog);

      let recognitionError = "";
      if (Zotero.RecognizeDocument.canRecognize(attachment)) {
        try {
          await Zotero.RecognizeDocument.recognizeItems([attachment]);
        } catch (e) {
          recognitionError = String(e);
          Zotero.logError(e);
        }
      }

      let parent = attachment.parentItem;
      let recognized = !recognitionError;
      if (!parent || parent.deleted || !parent.isRegularItem()) {
        recognized = false;
        parent = await this.createFallbackParent(plan, primary, attachment);
      }
      createdItems.push(parent);
      this.recordCreatedItem(logRecord, parent, recognized ? "recognized_parent" : "fallback_parent");
      if (recognitionError) parent.addTag("needs_review");
      logRecord.recognitionError = recognitionError;
      await this.writeRunLog(runLog);

      const sidecarItems = [];
      for (const sidecar of sidecars) {
        if (!options.allowAlreadyLinkedSidecars && linkedPaths.has(this.normalizePath(sidecar.path))) continue;
        const item = await Zotero.Attachments.linkFromFile({
          file: sidecar.path,
          parentItemID: parent.id,
          title: this.leafName(sidecar.path)
        });
        createdItems.push(item);
        fileBindings.set(sidecar, item);
        this.recordCreatedItem(logRecord, item, "sidecar_attachment");
        sidecarItems.push({ item, source: sidecar });
        await this.writeRunLog(runLog);
      }

      const tags = await this.parentTextAndKeywordTags(parent, attachment, primary);
      for (const tag of tags) parent.addTag(tag);
      await parent.saveTx();

      let renamed = 0;
      if (!primary.reusedExisting) {
        const primaryName = this.makePrimaryFileName(parent, attachment);
        if ((await attachment.renameAttachmentFile(primaryName, { unique: true, updateTitle: false })) === true) {
          renamed++;
        }
      }
      this.updateMovedPath(primary, attachment);
      await this.writeRunLog(runLog);

      const counters = {};
      for (const pair of sidecarItems) {
        const sidecarName = this.makeSidecarFileName(parent, pair.source.originalFilename || this.leafName(pair.source.path), counters);
        if ((await pair.item.renameAttachmentFile(sidecarName, { unique: true, updateTitle: false })) === true) {
          renamed++;
        }
        this.updateMovedPath(pair.source, pair.item);
        await this.writeRunLog(runLog);
      }

      Object.assign(logRecord, {
        status: options.logStatus || "imported",
        title: parent.getField("title") || plan.articleName,
        itemKey: parent.key,
        itemID: parent.id,
        recognized,
        primarySelectionNote: plan.primarySelectionNote,
        primary: this.fileLog(primary, attachment),
        sidecars: sidecarItems.map((pair) => this.fileLog(pair.source, pair.item)),
        ignored: plan.ignored || [],
        archivedFolder: "",
        renamed
      });
      await this.writeRunLog(runLog);

      if (options.archiveFolder !== false) {
        try {
          logRecord.archivedFolder = await this.archiveCompletedFolder(plan.folderPath);
          await this.writeRunLog(runLog);
        } catch (e) {
          logRecord.archiveError = String(e);
          Zotero.logError(e);
          await this.writeRunLog(runLog);
        }
      }

      return {
        imported: 1,
        skipped: 0,
        renamed,
        sidecars: sidecarItems.length,
        title: logRecord.title,
        recognized,
        primarySelectionNote: plan.primarySelectionNote,
        ignored: plan.ignored || [],
        logRecord
      };
    } catch (e) {
      logRecord.error = String(e);
      await this.rollbackOperation(runLog, logRecord, createdItems, moved, fileBindings);
      const error = e instanceof Error ? e : new Error(String(e));
      error.researchLibraryLogged = true;
      throw error;
    }
  },

  async createFallbackParent(plan, primary, attachment) {
    const parsed = this.parseFallbackMetadata(plan.articleName, primary.originalFilename);
    const parent = new Zotero.Item(parsed.isThesis ? "thesis" : "journalArticle");
    parent.libraryID = Zotero.Libraries.userLibraryID;
    parent.setField("title", parsed.title || plan.articleName || primary.originalFilename);
    if (parsed.year) parent.setField("date", parsed.year);
    if (parsed.isThesis) {
      try {
        parent.setField("thesisType", parsed.thesisType || "学位论文");
      } catch (e) {}
    }
    if (parsed.author) {
      try {
        parent.setCreators([{ creatorType: "author", name: parsed.author }]);
      } catch (e) {}
    }
    parent.addTag("needs_review");
    if (parsed.isChinese) parent.addTag("Chinese");
    if (parsed.isThesis) parent.addTag("thesis");
    await parent.saveTx();
    attachment.parentID = parent.id;
    attachment.parentItemID = parent.id;
    await attachment.saveTx();
    return parent;
  },

  parseFallbackMetadata(articleName, filename) {
    const raw = this.stripExtension(filename || articleName || "Untitled")
      .replace(/^IMPORT_\d{8}_\d{6}_/, "")
      .replace(/[【】\[\]()（）]/g, "_");
    const parts = raw.split(/[_\-–—]+/).map((s) => s.trim()).filter(Boolean);
    const joined = parts.join(" ");
    const yearMatch = joined.match(/(?:19|20)\d{2}/);
    const isChinese = /[\u4e00-\u9fff]/.test(joined);
    const isThesis = /硕士|博士|学位|毕业论文|thesis|dissertation/i.test(joined);
    const author = parts.find((part) => /^[\u4e00-\u9fff]{2,4}$/.test(part) && !/心理学|论文|硕士|博士/.test(part)) || "";
    const titleCandidates = parts
      .filter((part) => /[\u4e00-\u9fff]/.test(part))
      .filter((part) => part !== author)
      .filter((part) => !/^\d+$/.test(part))
      .sort((a, b) => b.length - a.length);
    const title = titleCandidates[0] || parts.filter((part) => !/^\d+$/.test(part) && part !== author).join(" ") || raw;
    let thesisType = "";
    if (/博士/.test(joined)) thesisType = "博士学位论文";
    if (/硕士/.test(joined)) thesisType = "硕士学位论文";
    return {
      title,
      author,
      year: yearMatch ? yearMatch[0] : "",
      isChinese,
      isThesis,
      thesisType
    };
  },

  async moveToDestination(sourcePath) {
    const source = Zotero.File.pathToFile(sourcePath);
    const destinationDir = Zotero.File.pathToFile(this.config.destinationDir);
    const originalFilename = source.leafName;
    this.ensureDir(destinationDir.path);
    if (this.normalizePath(source.parent.path) === this.normalizePath(destinationDir.path)) {
      return {
        originalPath: sourcePath,
        path: source.path,
        originalFilename,
        moved: false
      };
    }

    const targetName = this.uniqueDestinationName(destinationDir, originalFilename);
    const target = destinationDir.clone();
    target.append(targetName);
    source.moveTo(destinationDir, targetName);
    return {
      originalPath: sourcePath,
      path: target.path,
      originalFilename,
      moved: true
    };
  },

  async archiveCompletedFolder(folderPath) {
    if (!folderPath || !this.config.moveCompletedFolders) return "";
    const folder = Zotero.File.pathToFile(folderPath);
    if (!folder.exists() || !folder.isDirectory() || !this.isDirectoryEmpty(folder)) return "";
    const importedDir = Zotero.File.pathToFile(this.config.importedDir);
    this.ensureDir(importedDir.path);
    const targetName = this.uniqueFolderName(importedDir, `${this.timestamp()}_${folder.leafName}`);
    folder.moveTo(importedDir, targetName);
    return this.joinPath(importedDir.path, targetName);
  },

  uniqueDestinationName(destinationDir, originalName) {
    const ext = this.ext(originalName);
    const base = this.safeComponent(this.stripExtension(originalName), "Attachment");
    const stamp = this.timestamp();
    for (let i = 0; i < 1000; i++) {
      const suffix = i ? "_" + String(i + 1).padStart(2, "0") : "";
      const name = `${this.config.stagingPrefix}${stamp}_${base}${suffix}${ext}`;
      const target = destinationDir.clone();
      target.append(name);
      if (!target.exists()) return name;
    }
    throw new Error("Could not create a unique destination name for " + originalName);
  },

  uniqueFolderName(parentDir, desiredName) {
    const base = this.safeComponent(desiredName, "Imported");
    for (let i = 0; i < 1000; i++) {
      const suffix = i ? "_" + String(i + 1).padStart(2, "0") : "";
      const name = base + suffix;
      const target = parentDir.clone();
      target.append(name);
      if (!target.exists()) return name;
    }
    throw new Error("Could not create a unique imported folder name.");
  },

  async existingLinkedFilePaths() {
    const ids = await Zotero.DB.columnQueryAsync("SELECT itemID FROM itemAttachments");
    const paths = [];
    for (const id of ids) {
      const item = Zotero.Items.get(id);
      if (!item || item.deleted || !item.isAttachment()) continue;
      if (item.attachmentLinkMode !== Zotero.Attachments.LINK_MODE_LINKED_FILE) continue;
      const path = item.getFilePath();
      if (path) paths.push(path);
    }
    return paths;
  },

  async buildExistingPdfIndex() {
    const bySize = new Map();
    const seen = new Set();
    const candidates = [
      ...(await this.existingLinkedFilePaths()),
      ...this.collectFilesRecursive(this.config.destinationDir)
    ];
    for (const path of candidates) {
      const norm = this.normalizePath(path);
      if (seen.has(norm) || this.ext(path) !== ".pdf") continue;
      seen.add(norm);
      const file = Zotero.File.pathToFile(path);
      if (!file.exists() || !file.isFile()) continue;
      const size = this.fileSize(path);
      if (!bySize.has(size)) bySize.set(size, []);
      bySize.get(size).push(path);
    }
    return bySize;
  },

  async findDuplicatePdf(sourcePath, hashIndex, hashCache = new Map()) {
    const size = this.fileSize(sourcePath);
    const candidates = hashIndex.get(size) || [];
    if (!candidates.length) return null;
    const sourceHash = await this.sha256Cached(sourcePath, hashCache);
    if (!sourceHash) return null;
    for (const candidate of candidates) {
      if (this.normalizePath(candidate) === this.normalizePath(sourcePath)) continue;
      const candidateHash = await this.sha256Cached(candidate, hashCache);
      if (candidateHash && candidateHash === sourceHash) {
        return { reason: "same_sha256_pdf", path: candidate, sha256: sourceHash };
      }
    }
    return null;
  },

  async sha256Cached(path, cache) {
    const key = this.normalizePath(path);
    if (!cache.has(key)) cache.set(key, await this.sha256(path));
    return cache.get(key);
  },

  collectFilesRecursive(rootPath) {
    const root = Zotero.File.pathToFile(rootPath);
    const out = [];
    if (!root.exists()) return out;
    const walk = (file) => {
      try {
        if (!file.exists()) return;
        if (file.isDirectory()) {
          const entries = file.directoryEntries;
          while (entries.hasMoreElements()) {
            walk(entries.getNext().QueryInterface(Ci.nsIFile));
          }
        } else if (file.isFile()) {
          out.push(file.path);
        }
      } catch (e) {
        Zotero.logError(e);
      }
    };
    walk(root);
    return out;
  },

  async sha256(path) {
    try {
      if (!globalThis.crypto?.subtle) return "";
      const bytes = await IOUtils.read(path);
      const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (e) {
      Zotero.logError(e);
      return "";
    }
  },

  async loadTagDictionary() {
    try {
      if (await IOUtils.exists(this.config.tagDictionaryPath)) {
        return JSON.parse(await this.readText(this.config.tagDictionaryPath));
      }
    } catch (e) {
      Zotero.logError(e);
    }
    return this.defaultTagDictionary;
  },

  async parentTextAndKeywordTags(item, attachment, rec) {
    const fields = [
      item.getField("title"),
      item.getField("abstractNote"),
      item.getField("publicationTitle"),
      item.getField("repository"),
      item.getField("extra"),
      rec.originalFilename,
      attachment ? attachment.attachmentFilename : ""
    ];
    const existing = [];
    try {
      for (const tag of item.getTags()) existing.push(tag.tag || tag.name || String(tag));
    } catch (e) {}
    return this.tagsFromText(fields.join(" "), existing, await this.loadTagDictionary());
  },

  tagsFromText(text, existingTags, dictionary) {
    const out = new Set();
    const haystack = String(text || "").toLowerCase();
    for (const [tag, triggers] of Object.entries(dictionary || {})) {
      for (const trigger of triggers || []) {
        if (haystack.includes(String(trigger).toLowerCase())) {
          out.add(tag);
          break;
        }
      }
    }
    for (const raw of existingTags || []) {
      const clean = this.oneTokenTag(raw);
      if (clean) out.add(clean);
      const lower = String(raw || "").toLowerCase();
      for (const [tag, triggers] of Object.entries(dictionary || {})) {
        if ((triggers || []).some((trigger) => lower === String(trigger).toLowerCase())) out.add(tag);
      }
    }
    return [...out].sort((a, b) => a.localeCompare(b));
  },

  oneTokenTag(s) {
    s = String(s || "").trim();
    if (!s) return "";
    s = s.replace(/^#/, "");
    if (/\s/.test(s)) return "";
    if (!/^[A-Za-z0-9_+\-\u4e00-\u9fff]{2,32}$/.test(s)) return "";
    return s;
  },

  makeBaseName(item) {
    const journal = this.safeComponent(this.journalName(item), "UnknownJournal");
    const year = this.safeComponent(this.yearFromDate(item.getField("date")), "UnknownYear");
    const author = this.safeComponent(this.firstCreator(item), "UnknownAuthor");
    const title = this.safeComponent(this.titleForFilename(item.getField("title"), this.config.filenameTitleWordLimit), "Untitled");
    return `${journal}_${year}_${author}_${title}`;
  },

  makePrimaryFileName(item, attachment) {
    const extension = this.ext(attachment.attachmentFilename) || ".pdf";
    return this.boundedFileName(this.makeBaseName(item), "", extension);
  },

  makeSidecarFileName(item, filename, counters) {
    const kind = this.sidecarKind(filename);
    counters[kind] = (counters[kind] || 0) + 1;
    const n = String(counters[kind]).padStart(2, "0");
    const extension = this.ext(filename) || ".dat";
    return this.boundedFileName(this.makeBaseName(item), `_${kind}${n}`, extension);
  },

  sidecarKind(filename) {
    const lower = String(filename || "").toLowerCase();
    if (this.hasDataAttachmentMarker(lower)) return "Data";
    if (this.hasTableAttachmentMarker(lower)) return "Table";
    if (this.hasFigureAttachmentMarker(lower)) return "Figure";
    if (this.hasCodeAttachmentMarker(lower)) return "Code";
    if (this.hasReferenceAttachmentMarker(lower)) return "Reference";
    if (this.hasPublisherSupplementMarker(lower)) return "Supplement";
    if (/\.(xlsx?|csv|json|xml)$/i.test(lower)) return "Data";
    if (/\.(png|jpe?g|tiff?|gif|webp)$/i.test(lower)) return "Figure";
    if (/\.(zip|m|r|py)$/i.test(lower)) return "Code";
    if (/\.(bib|ris)$/i.test(lower)) return "Reference";
    return "Attachment";
  },

  isSidecarName(path) {
    const lower = this.leafName(path).toLowerCase();
    return this.hasPublisherSupplementMarker(lower)
      || this.hasFigureAttachmentMarker(lower)
      || this.hasTableAttachmentMarker(lower)
      || this.hasDataAttachmentMarker(lower)
      || this.hasCodeAttachmentMarker(lower)
      || this.hasReferenceAttachmentMarker(lower);
  },

  hasPublisherSupplementMarker(lower) {
    const name = this.normalizedName(lower);
    const words = ["supplement", "supplementary", "supplemental", "suppl", "suppinfo", "supporting", "appendix", "appendices", "additional_material", "additional_materials", "additional_file", "additional_files", "online_resource", "附录", "补充", "附件", "补充信息", "支持信息"];
    return words.some((word) => name.includes(word))
      || /(^|[_\-\s.])moesm\d*(_esm)?([_\-\s.]|$)/.test(name)
      || /(^|[_\-\s.])esm[_\-\s]?\d*([_\-\s.]|$)/.test(name)
      || /(^|[_\-\s.])mmc\d+([_\-\s.]|$)/.test(name)
      || /(^|[_\-\s.])s\d{3}([_\-\s.]|$)/.test(name)
      || /(^|[_\-\s.])s\d+[_\-\s]?(appendix|table|fig|figure|text|file|data|movie|video|protocol)([_\-\s.]|$)/.test(name)
      || /(^|[_\-\s.])si([_\-\s.]|$)/.test(lower)
      || /(^|[_\-\s.])s[1-9]([_\-\s.]|$)/.test(lower);
  },

  hasDataAttachmentMarker(lower) {
    const name = this.normalizedName(lower);
    return /(^|[_\-\s.])data[_\-\s]?sheet[_\-\s]?\d*([_\-\s.]|$)/.test(name)
      || /(^|[_\-\s.])dataset[_\-\s]?\d*([_\-\s.]|$)/.test(name)
      || /(^|[_\-\s.])source[_\-\s]?data([_\-\s.]|$)/.test(name)
      || /(^|[_\-\s.])raw[_\-\s]?data([_\-\s.]|$)/.test(name)
      || /supplementary[_\-\s]?materials?[_\-\s]?datasheets?/.test(name)
      || name.includes("数据");
  },

  hasTableAttachmentMarker(lower) {
    const name = this.normalizedName(lower);
    return /(^|[_\-\s.])(table|tab)[_\-\s]?\d+([_\-\s.]|$)/.test(name)
      || /(^|[_\-\s.])s\d+[_\-\s]?(table|tab)([_\-\s.]|$)/.test(name)
      || name.includes("表格")
      || /(^|[_\-\s.])表[_\-\s]?\d*([_\-\s.]|$)/.test(name);
  },

  hasFigureAttachmentMarker(lower) {
    const name = this.normalizedName(lower);
    return /(^|[_\-\s.])(fig|figure|image)[_\-\s]?\d+([_\-\s.]|$)/.test(name)
      || /(^|[_\-\s.])s\d+[_\-\s]?(fig|figure|image)([_\-\s.]|$)/.test(name)
      || name.includes("graphical_abstract")
      || name.includes("highres")
      || name.includes("high_res")
      || name.includes("高清")
      || /(^|[_\-\s.])图[_\-\s]?\d*([_\-\s.]|$)/.test(name);
  },

  hasCodeAttachmentMarker(lower) {
    const name = this.normalizedName(lower);
    return /(^|[_\-\s.])(code|script|software|analysis_code)([_\-\s.]|$)/.test(name)
      || name.includes("代码");
  },

  hasReferenceAttachmentMarker(lower) {
    const name = this.normalizedName(lower);
    return /(^|[_\-\s.])(reference|references|reference_list|bibliography)([_\-\s.]|$)/.test(name)
      || name.includes("参考文献")
      || name.includes("参考材料");
  },

  normalizedName(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/%20/g, " ")
      .replace(/[()[\]{}【】（）]/g, "_")
      .replace(/\s+/g, "_");
  },

  journalName(item) {
    return item.getField("publicationTitle")
      || item.getField("repository")
      || item.getField("conferenceName")
      || item.getField("publisher")
      || "UnknownJournal";
  },

  firstCreator(item) {
    try {
      const creators = item.getCreators();
      if (creators && creators.length) {
        const creator = creators[0];
        return creator.lastName || creator.name || creator.firstName || "UnknownAuthor";
      }
    } catch (e) {}
    return "UnknownAuthor";
  },

  titleForFilename(title, limit) {
    const words = String(title || "").replace(/[_\s]+/g, " ").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "Untitled";
    return words.slice(0, limit || 14).join(" ");
  },

  yearFromDate(s) {
    const match = String(s || "").match(/(?:19|20)\d{2}/);
    return match ? match[0] : "UnknownYear";
  },

  async writeRunLog(runLog) {
    this.ensureDir(this.config.logsDir);
    const path = this.joinPath(this.config.logsDir, `import_${runLog.runId}.json`);
    const latest = this.joinPath(this.config.logsDir, "latest_import_log.json");
    const text = JSON.stringify(runLog, null, 2);
    await this.writeText(path, text);
    await this.writeText(latest, text);
    return path;
  },

  async startOperationRecord(runLog, plan, status = "in_progress") {
    const record = {
      operationId: this.runIdentifier(),
      articleName: plan.articleName || "",
      status,
      sourcePaths: [...(plan.sourcePaths || [])],
      moves: [],
      createdItems: [],
      rollback: null,
      recoveryRequired: false
    };
    runLog.records.push(record);
    await this.writeRunLog(runLog);
    return record;
  },

  recordMove(record, moved) {
    const entry = {
      originalPath: moved.originalPath,
      importedPath: moved.path,
      currentPath: moved.currentPath || moved.path,
      originalFilename: moved.originalFilename,
      moved: !!moved.moved,
      reusedExisting: !!moved.reusedExisting
    };
    record.moves.push(entry);
    moved.journalEntry = entry;
  },

  recordCreatedItem(record, item, role) {
    record.createdItems.push({
      role,
      itemKey: item?.key || "",
      itemID: item?.id || ""
    });
  },

  updateMovedPath(moved, item) {
    const path = item?.getFilePath?.() || moved.currentPath || moved.path;
    moved.currentPath = path;
    if (moved.journalEntry) moved.journalEntry.currentPath = path;
  },

  async rollbackOperation(runLog, record, createdItems, movedFiles, fileBindings) {
    record.status = "rolling_back";
    try {
      await this.writeRunLog(runLog);
    } catch (e) {
      Zotero.logError(e);
    }

    const actions = [];
    let failed = false;
    for (const moved of [...movedFiles].reverse()) {
      if (!moved.moved) continue;
      try {
        const item = fileBindings.get(moved);
        const currentPath = item?.getFilePath?.() || moved.currentPath || moved.path;
        const current = Zotero.File.pathToFile(currentPath);
        const original = Zotero.File.pathToFile(moved.originalPath);
        if (original.exists()) throw new Error("Original path is already occupied: " + original.path);
        if (!current.exists()) throw new Error("Imported file is missing: " + currentPath);
        current.moveTo(original.parent, original.leafName);
        moved.currentPath = original.path;
        if (moved.journalEntry) moved.journalEntry.currentPath = original.path;
        actions.push({ type: "restore_file", from: currentPath, to: original.path, status: "restored" });
      } catch (e) {
        failed = true;
        actions.push({
          type: "restore_file",
          from: moved.currentPath || moved.path,
          to: moved.originalPath,
          status: "error",
          error: String(e)
        });
      }
    }

    const orderedItems = [
      ...createdItems.filter((item) => item?.isAttachment?.()).reverse(),
      ...createdItems.filter((item) => !item?.isAttachment?.()).reverse()
    ];
    for (const item of orderedItems) {
      try {
        if (!item || item.deleted) continue;
        const itemKey = item.key || "";
        const itemID = item.id || "";
        await item.eraseTx();
        actions.push({ type: "erase_item", itemKey, itemID, status: "erased" });
      } catch (e) {
        failed = true;
        actions.push({
          type: "erase_item",
          itemKey: item?.key || "",
          itemID: item?.id || "",
          status: "error",
          error: String(e)
        });
      }
    }

    record.rollback = { completedAt: new Date().toISOString(), actions };
    record.recoveryRequired = failed;
    record.status = failed ? "error_recovery_required" : "rolled_back";
    try {
      await this.writeRunLog(runLog);
    } catch (e) {
      Zotero.logError(e);
    }
  },

  newRunLog(mode, plans) {
    return {
      runId: this.runIdentifier(),
      generatedAt: new Date().toISOString(),
      mode,
      config: {
        inboxDir: this.config.defaultInboxDir,
        destinationDir: this.config.destinationDir,
        importedDir: this.config.importedDir
      },
      planned: plans.map((plan) => ({
        articleName: plan.articleName,
        primaryPath: plan.primaryPath,
        sidecarCount: plan.sidecarPaths ? plan.sidecarPaths.length : 0,
        ignoredCount: plan.ignored ? plan.ignored.length : 0,
        error: plan.error || "",
        duplicate: plan.duplicate || null,
        reuseExistingPath: plan.reuseExistingPath || ""
      })),
      records: []
    };
  },

  skippedLogRecord(plan) {
    return {
      articleName: plan.articleName,
      status: plan.duplicate ? "skipped_duplicate" : "needs_review",
      error: plan.error || "",
      duplicate: plan.duplicate || null,
      sourcePaths: plan.sourcePaths || [],
      ignored: plan.ignored || []
    };
  },

  fileLog(moved, attachment) {
    return {
      originalPath: moved.originalPath,
      importedPath: moved.path,
      finalPath: attachment?.getFilePath ? attachment.getFilePath() : moved.path,
      originalFilename: moved.originalFilename,
      reusedExisting: !!moved.reusedExisting,
      attachmentKey: attachment?.key || "",
      attachmentID: attachment?.id || ""
    };
  },

  async showLastImportInfo(window) {
    try {
      const latest = this.joinPath(this.config.logsDir, "latest_import_log.json");
      if (!(await IOUtils.exists(latest))) {
        this.alert(window, "Research Library Importer", "No import log found yet.");
        return;
      }
      const log = JSON.parse(await this.readText(latest));
      const records = log.records || [];
      const failures = records.filter((r) => ["error", "rolled_back", "error_recovery_required"].includes(r.status));
      const lines = [
        `Run ID: ${log.runId}`,
        `Mode: ${log.mode}`,
        `Operation records: ${records.length}`,
        `Failed/rolled back: ${failures.length}`,
        "",
        "Recovery hint:",
        "Review each status and the rollback section in the JSON log before making manual changes.",
        "",
        `Log file: ${latest}`
      ];
      for (const record of records.slice(0, 10)) {
        lines.push(`- [${record.status || "unknown"}] ${record.itemKey || ""}: ${record.title || record.articleName || ""}`);
        if (record.primary?.finalPath) lines.push(`  primary: ${record.primary.finalPath}`);
        if (record.recoveryRequired) lines.push("  manual recovery required; see rollback actions");
      }
      if (records.length > 10) lines.push(`... plus ${records.length - 10} more`);
      this.alert(window, "Research Library Last Import", lines.join("\n"));
    } catch (e) {
      this.handleError(window, e);
    }
  },

  showSettings(window) {
    try {
      Zotero.Utilities.Internal.openPreferences("zotero-prefpane-research-library-paper-importer");
    } catch (e) {
      Zotero.logError(e);
      this.alert(window, "Research Library Settings", "Open Zotero Settings, then select Research Library Importer.");
    }
  },

  getSettingsSnapshot() {
    return {
      defaultInboxDir: String(this.config.defaultInboxDir || ""),
      destinationDir: String(this.config.destinationDir || ""),
      importedDir: String(this.config.importedDir || ""),
      logsDir: String(this.config.logsDir || ""),
      tagDictionaryPath: String(this.config.tagDictionaryPath || ""),
      filenameTitleWordLimit: Number(this.config.filenameTitleWordLimit || 14),
      moveCompletedFolders: !!this.config.moveCompletedFolders
    };
  },

  applySettings(values) {
    for (const key of ["defaultInboxDir", "destinationDir", "importedDir", "logsDir", "tagDictionaryPath"]) {
      const value = String(values?.[key] || "").trim();
      if (!value && key !== "tagDictionaryPath") continue;
      this.config[key] = value;
      Services.prefs.setStringPref(this.prefPrefix + key, value);
    }

    const titleLimit = parseInt(values?.filenameTitleWordLimit, 10);
    if (Number.isFinite(titleLimit) && titleLimit > 0 && titleLimit <= 80) {
      this.config.filenameTitleWordLimit = titleLimit;
      Services.prefs.setIntPref(this.prefPrefix + "filenameTitleWordLimit", titleLimit);
    }

    this.config.moveCompletedFolders = !!values?.moveCompletedFolders;
    Services.prefs.setBoolPref(this.prefPrefix + "moveCompletedFolders", this.config.moveCompletedFolders);
    this.repairRequiredSettings();
  },

  loadSettings() {
    for (const key of ["defaultInboxDir", "destinationDir", "importedDir", "logsDir", "tagDictionaryPath"]) {
      const pref = this.prefPrefix + key;
      if (Services.prefs.prefHasUserValue(pref)) {
        this.config[key] = Services.prefs.getStringPref(pref, this.config[key]);
      }
    }
    const intPref = this.prefPrefix + "filenameTitleWordLimit";
    if (Services.prefs.prefHasUserValue(intPref)) {
      this.config.filenameTitleWordLimit = Services.prefs.getIntPref(intPref, this.config.filenameTitleWordLimit);
    }
    const boolPref = this.prefPrefix + "moveCompletedFolders";
    if (Services.prefs.prefHasUserValue(boolPref)) {
      this.config.moveCompletedFolders = Services.prefs.getBoolPref(boolPref, this.config.moveCompletedFolders);
    }
  },

  repairRequiredSettings() {
    const defaults = this.platformDefaultConfig();
    for (const key of ["defaultInboxDir", "destinationDir", "importedDir", "logsDir"]) {
      const value = String(this.config[key] || "").trim();
      if (value && !this.isInvalidPlatformPath(value)) continue;
      try {
        Services.prefs.clearUserPref(this.prefPrefix + key);
      } catch (e) {}
      this.config[key] = defaults[key];
    }
    if (this.isInvalidPlatformPath(this.config.tagDictionaryPath)) {
      try {
        Services.prefs.clearUserPref(this.prefPrefix + "tagDictionaryPath");
      } catch (e) {}
      this.config.tagDictionaryPath = defaults.tagDictionaryPath;
    }
    if (!String(this.config.tagDictionaryPath || "").trim()) {
      this.config.tagDictionaryPath = defaults.tagDictionaryPath;
    }
    if (!Number.isInteger(this.config.filenameTitleWordLimit)
        || this.config.filenameTitleWordLimit < 1
        || this.config.filenameTitleWordLimit > 80) {
      this.config.filenameTitleWordLimit = 14;
      Services.prefs.setIntPref(this.prefPrefix + "filenameTitleWordLimit", 14);
    }
  },

  isInvalidPlatformPath(path) {
    return !this.isWindows() && /^[A-Za-z]:[\\\/]/.test(String(path || ""));
  },

  formatBatchResult(plans, ready, results, logPath) {
    const imported = results.reduce((n, r) => n + (r.imported || 0), 0);
    const sidecars = results.reduce((n, r) => n + (r.sidecars || 0), 0);
    const renamed = results.reduce((n, r) => n + (r.renamed || 0), 0);
    const duplicates = plans.filter((plan) => plan.duplicate).length;
    const needsReview = plans.filter((plan) => plan.error).length;
    const executionFailures = Math.max(0, ready.length - imported);
    return [
      `Imported articles: ${imported}`,
      `Attached sidecars: ${sidecars}`,
      `Renamed files: ${renamed}`,
      `Skipped duplicates: ${duplicates}`,
      `Needs review/errors: ${needsReview}`,
      `Execution failures/rolled back: ${executionFailures}`,
      `Planned ready articles: ${ready.length}`,
      "",
      `Log: ${logPath}`
    ].join("\n");
  },

  async readText(path) {
    if (IOUtils.readUTF8) return IOUtils.readUTF8(path);
    const bytes = await IOUtils.read(path);
    return new TextDecoder("utf-8").decode(bytes);
  },

  async writeText(path, text) {
    if (IOUtils.writeUTF8) {
      await IOUtils.writeUTF8(path, text);
      return;
    }
    await IOUtils.write(path, new TextEncoder().encode(text));
  },

  ensureDir(path) {
    const dir = Zotero.File.pathToFile(path);
    if (!dir.exists()) dir.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
  },

  isDirectoryEmpty(dir) {
    const entries = dir.directoryEntries;
    return !entries.hasMoreElements();
  },

  fileSize(path) {
    try {
      return Zotero.File.pathToFile(path).fileSize || 0;
    } catch (e) {
      return 0;
    }
  },

  safeComponent(s, fallback = "Unknown") {
    s = String(s || "").trim();
    if (!s) s = fallback;
    s = s.replace(/[<>:"/\\|?*\x00-\x1f]/g, " ");
    s = s.replace(/[_\s]+/g, " ").replace(/^[. ]+|[. ]+$/g, "");
    return (s || fallback).slice(0, 90).replace(/[. ]+$/g, "");
  },

  boundedFileName(base, suffix, extension, maxLength = 200) {
    const ext = String(extension || "").startsWith(".") ? String(extension) : `.${extension}`;
    const tail = String(suffix || "") + ext;
    const available = Math.max(1, maxLength - tail.length);
    let stem = Array.from(String(base || "Attachment")).slice(0, available).join("").replace(/[. ]+$/g, "");
    if (!stem) stem = "Attachment".slice(0, available);
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem)) stem = ("_" + stem).slice(0, available);
    return stem + tail;
  },

  ext(pathOrName) {
    const match = String(pathOrName || "").match(/\.([^.\\\/]+)$/);
    return match ? "." + match[1].toLowerCase() : "";
  },

  stripExtension(pathOrName) {
    return String(pathOrName || "").replace(/\.[^.\\\/]+$/, "");
  },

  leafName(path) {
    try {
      return Zotero.File.pathToFile(path).leafName;
    } catch (e) {
      return String(path || "").split(/[\\\/]/).pop() || "";
    }
  },

  normalizePath(path) {
    return String(path || "").replace(/\\/g, "/").toLowerCase();
  },

  timestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  },

  runIdentifier() {
    return `${this.timestamp()}_${String(new Date().getMilliseconds()).padStart(3, "0")}`;
  },

  handleError(window, e) {
    Zotero.logError(e);
    this.alert(window, "Research Library Importer Error", String(e));
  },

  alert(window, title, message) {
    Services.prompt.alert(window, title, message);
  }
};
