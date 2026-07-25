const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "paper-importer.js"), "utf8")
  .replace(/^var \{ FilePicker \}[^\n]*\n/, "");

const context = {
  console,
  crypto: crypto.webcrypto,
  Ci: { nsIFile: {} },
  TextDecoder,
  TextEncoder,
  Services: {
    appinfo: { OS: "WINNT" },
    prompt: { alert() {} }
  },
  Zotero: {
    File: {
      pathToFile(value) {
        return { leafName: String(value).split(/[\\/]/).pop() || "" };
      }
    },
    logError() {}
  },
  IOUtils: {}
};
vm.createContext(context);
vm.runInContext(`${source}\nglobalThis.plugin = ResearchLibraryPaperImporter;`, context);
const plugin = context.plugin;

async function testFlatInboxPdfsBecomeSeparateArticles() {
  const inboxPath = "D:\\Research_Library\\00_Inbox";
  const pdfPaths = [
    `${inboxPath}\\Alpha.pdf`,
    `${inboxPath}\\Beta.pdf`
  ];
  const entries = pdfPaths.map((filePath) => ({
    path: filePath,
    leafName: path.win32.basename(filePath),
    isDirectory: () => false,
    isFile: () => true,
    QueryInterface() {
      return this;
    }
  }));
  const originalPathToFile = context.Zotero.File.pathToFile;
  const originalInboxDir = plugin.config.defaultInboxDir;
  context.Zotero.File.pathToFile = (value) => {
    if (value === inboxPath) {
      let index = 0;
      return {
        exists: () => true,
        isDirectory: () => true,
        directoryEntries: {
          hasMoreElements: () => index < entries.length,
          getNext: () => entries[index++]
        }
      };
    }
    return { leafName: path.win32.basename(String(value)) };
  };
  plugin.config.defaultInboxDir = inboxPath;
  try {
    const plans = plugin.planInbox();
    assert.equal(plans.length, 2);
    assert.deepEqual(
      Array.from(plans, (plan) => ({
        articleName: plan.articleName,
        primaryPath: plan.primaryPath,
        sourceCount: plan.sourcePaths.length,
        sidecarCount: plan.sidecarPaths.length
      })),
      [
        { articleName: "Alpha", primaryPath: pdfPaths[0], sourceCount: 1, sidecarCount: 0 },
        { articleName: "Beta", primaryPath: pdfPaths[1], sourceCount: 1, sidecarCount: 0 }
      ]
    );
  } finally {
    context.Zotero.File.pathToFile = originalPathToFile;
    plugin.config.defaultInboxDir = originalInboxDir;
  }
}

async function testBatchPreviewIsCompact() {
  let message = "";
  const originalConfirm = context.Services.prompt.confirm;
  context.Services.prompt.confirm = (_window, _title, value) => {
    message = value;
    return true;
  };
  const longName = "Very-long-article-title-that-would-normally-wrap-across-the-dialog-";
  const plans = [
    ...Array.from({ length: 30 }, (_, index) => ({
      articleName: `${longName}${index}`,
      primaryPath: `D:\\Inbox\\${longName}${index}.pdf`,
      sidecarPaths: [],
      ignored: [],
      error: "",
      duplicate: null,
      primarySelectionNote: index === 0 ? `${longName}${longName}` : ""
    })),
    ...Array.from({ length: 4 }, (_, index) => ({
      articleName: `Duplicate-${longName}${index}`,
      primaryPath: `D:\\Inbox\\duplicate-${index}.pdf`,
      sidecarPaths: [],
      ignored: [],
      error: "",
      duplicate: { path: `D:\\Papers\\${longName}${index}.pdf` }
    })),
    ...Array.from({ length: 4 }, (_, index) => ({
      articleName: `Error-${longName}${index}`,
      primaryPath: `D:\\Inbox\\error-${index}.pdf`,
      sidecarPaths: [],
      ignored: [],
      error: `${longName}${longName}`,
      duplicate: null
    }))
  ];
  try {
    assert.equal(plugin.confirmPlans(null, plans, "inbox"), true);
    assert(message.includes("... plus 25 more ready articles"));
    assert(message.includes("... plus 2 more duplicates"));
    assert(message.includes("... plus 2 more errors"));
    assert(message.split("\n").length <= 22);
    assert(Math.max(...message.split("\n").map((line) => line.length)) <= 110);
  } finally {
    context.Services.prompt.confirm = originalConfirm;
  }
}

async function testClassifications() {
  assert.equal(plugin.sidecarKind("Table1.xlsx"), "Table");
  assert.equal(plugin.sidecarKind("source_data.xlsx"), "Data");
  assert.equal(plugin.sidecarKind("analysis.py"), "Code");
  assert.equal(plugin.sidecarKind("figure_2.pdf"), "Figure");
  for (const extension of [".m", ".r", ".py"]) {
    assert(plugin.config.sidecarExtensions.includes(extension));
  }
}

async function testBoundedNames() {
  const long = "Long Journal Name ".repeat(20);
  const item = {
    getField(field) {
      return {
        publicationTitle: long,
        date: "2026",
        title: long
      }[field] || "";
    },
    getCreators() {
      return [{ lastName: long }];
    }
  };
  const primary = plugin.makePrimaryFileName(item, { attachmentFilename: "paper.pdf" });
  const sidecar = plugin.makeSidecarFileName(item, "Table1.xlsx", {});
  assert(primary.length <= 200);
  assert(primary.endsWith(".pdf"));
  assert(sidecar.length <= 200);
  assert(sidecar.endsWith("_Table01.xlsx"));
}

async function testBatchDeduplication() {
  plugin.existingLinkedFilePaths = async () => [];
  plugin.buildExistingPdfIndex = async () => new Map();
  plugin.fileSize = () => 1234;
  plugin.sha256 = async () => "same-hash";
  const plans = [
    { articleName: "A", error: "", primaryPath: "C:\\inbox\\a.pdf" },
    { articleName: "B", error: "", primaryPath: "C:\\inbox\\b.pdf" }
  ];
  await plugin.preparePlans(plans);
  assert.equal(plans[0].duplicate, undefined);
  assert.equal(plans[1].duplicate.reason, "same_batch_sha256_pdf");
  assert.equal(plans[1].duplicate.path, plans[0].primaryPath);
}

async function testDiskDuplicateIsReusedButLinkedDuplicateIsSkipped() {
  const existingDiskPdf = "D:\\papers\\existing-a.pdf";
  const existingLinkedPdf = "D:\\papers\\existing-b.pdf";
  plugin.existingLinkedFilePaths = async () => [existingLinkedPdf];
  plugin.buildExistingPdfIndex = async () => new Map([
    [100, [existingDiskPdf]],
    [200, [existingLinkedPdf]]
  ]);
  plugin.fileSize = (filePath) => filePath.endsWith("a.pdf") ? 100 : 200;
  plugin.sha256 = async (filePath) => filePath.endsWith("a.pdf") ? "hash-a" : "hash-b";
  const plans = [
    { articleName: "A", error: "", primaryPath: "C:\\inbox\\a.pdf", primarySelectionNote: "" },
    { articleName: "B", error: "", primaryPath: "C:\\inbox\\b.pdf", primarySelectionNote: "" }
  ];
  await plugin.preparePlans(plans);
  assert.equal(plans[0].duplicate, undefined);
  assert.equal(plans[0].reuseExistingPath, existingDiskPdf);
  assert.match(plans[0].primarySelectionNote, /reuse existing PDF/i);
  assert.equal(plans[1].reuseExistingPath, undefined);
  assert.equal(plans[1].duplicate.reason, "already_linked_same_sha256");
  assert.equal(plans[1].duplicate.path, existingLinkedPdf);
}

async function testExclusiveOperation() {
  const alerts = [];
  plugin.alert = (_window, _title, message) => alerts.push(message);
  let release;
  const first = plugin.runExclusive(null, "First", () => new Promise((resolve) => {
    release = resolve;
  }));
  await Promise.resolve();
  let secondRan = false;
  await plugin.runExclusive(null, "Second", async () => {
    secondRan = true;
  });
  assert.equal(secondRan, false);
  assert.match(alerts[0], /First/);
  release();
  await first;
  assert.equal(plugin.activeOperation, "");
}

async function testRecognitionFailureFallsBack() {
  const addedTags = [];
  const parent = {
    key: "PARENT",
    id: 2,
    deleted: false,
    isRegularItem: () => true,
    isAttachment: () => false,
    getField(field) {
      return {
        title: "Fallback title",
        publicationTitle: "UnknownJournal",
        date: "2026"
      }[field] || "";
    },
    getCreators: () => [{ lastName: "Author" }],
    addTag: (tag) => addedTags.push(tag),
    saveTx: async () => {},
    eraseTx: async () => {}
  };
  const attachment = {
    key: "ATTACH",
    id: 1,
    parentItem: null,
    attachmentFilename: "staged.pdf",
    isAttachment: () => true,
    getFilePath: () => "D:\\papers\\final.pdf",
    renameAttachmentFile: async () => true,
    eraseTx: async () => {}
  };
  context.Zotero.Attachments = {
    linkFromFile: async () => attachment
  };
  context.Zotero.RecognizeDocument = {
    canRecognize: () => true,
    recognizeItems: async () => {
      throw new Error("recognition unavailable");
    }
  };
  plugin.existingLinkedFilePaths = async () => [];
  plugin.writeRunLog = async () => "log.json";
  plugin.moveToDestination = async (sourcePath) => ({
    originalPath: sourcePath,
    path: "D:\\papers\\staged.pdf",
    originalFilename: "paper.pdf",
    moved: true
  });
  plugin.createFallbackParent = async () => parent;
  plugin.parentTextAndKeywordTags = async () => [];
  plugin.archiveCompletedFolder = async () => "";
  const runLog = { runId: "test", records: [] };
  const result = await plugin.executePlan({
    articleName: "Paper",
    sourcePaths: ["C:\\inbox\\paper.pdf"],
    primaryPath: "C:\\inbox\\paper.pdf",
    sidecarPaths: [],
    ignored: [],
    primarySelectionNote: ""
  }, { runLog, archiveFolder: false });
  assert.equal(result.recognized, false);
  assert.match(result.logRecord.recognitionError, /recognition unavailable/);
  assert(addedTags.includes("needs_review"));
  assert.equal(result.logRecord.status, "imported");
}

async function testReusedPrimaryIsNotMovedOrRenamed() {
  const parent = {
    key: "PARENT-REUSED",
    id: 12,
    deleted: false,
    isRegularItem: () => true,
    isAttachment: () => false,
    getField(field) {
      return {
        title: "Reused PDF",
        publicationTitle: "Journal",
        date: "2026"
      }[field] || "";
    },
    getCreators: () => [{ lastName: "Author" }],
    addTag() {},
    saveTx: async () => {},
    eraseTx: async () => {}
  };
  let renameCalls = 0;
  const attachment = {
    key: "ATTACH-REUSED",
    id: 11,
    parentItem: parent,
    attachmentFilename: "existing.pdf",
    isAttachment: () => true,
    getFilePath: () => "D:\\papers\\existing.pdf",
    renameAttachmentFile: async () => {
      renameCalls++;
      return true;
    },
    eraseTx: async () => {}
  };
  context.Zotero.Attachments = {
    linkFromFile: async ({ file }) => {
      assert.equal(file, "D:\\papers\\existing.pdf");
      return attachment;
    }
  };
  context.Zotero.RecognizeDocument = {
    canRecognize: () => false
  };
  context.Zotero.File.pathToFile = (value) => ({
    path: String(value),
    leafName: path.win32.basename(String(value)),
    exists: () => true,
    isFile: () => true
  });
  plugin.existingLinkedFilePaths = async () => [];
  plugin.writeRunLog = async () => "log.json";
  plugin.moveToDestination = async () => {
    throw new Error("reused primary must not be moved");
  };
  plugin.parentTextAndKeywordTags = async () => [];
  const runLog = { runId: "test-reused", records: [] };
  const result = await plugin.executePlan({
    articleName: "Reused PDF",
    sourcePaths: ["C:\\inbox\\paper.pdf"],
    primaryPath: "C:\\inbox\\paper.pdf",
    reuseExistingPath: "D:\\papers\\existing.pdf",
    sidecarPaths: [],
    ignored: [],
    primarySelectionNote: "Reuse existing PDF"
  }, { runLog, archiveFolder: false });
  assert.equal(result.imported, 1);
  assert.equal(renameCalls, 0);
  assert.equal(result.logRecord.primary.originalPath, "C:\\inbox\\paper.pdf");
  assert.equal(result.logRecord.primary.finalPath, "D:\\papers\\existing.pdf");
  assert.equal(result.logRecord.primary.reusedExisting, true);
}

async function testRollback() {
  const normalize = (value) => String(value).replace(/\\/g, "/").toLowerCase();
  const existing = new Set([normalize("D:\\papers\\staged.pdf")]);
  const moves = [];
  context.Zotero.File.pathToFile = (value) => {
    const originalPath = String(value);
    return {
      path: originalPath,
      leafName: originalPath.split(/[\\/]/).pop(),
      get parent() {
        return context.Zotero.File.pathToFile(originalPath.replace(/[\\/][^\\/]+$/, ""));
      },
      exists() {
        return existing.has(normalize(originalPath));
      },
      moveTo(parent, leafName) {
        const target = `${parent.path}\\${leafName}`;
        existing.delete(normalize(originalPath));
        existing.add(normalize(target));
        moves.push([originalPath, target]);
      }
    };
  };
  plugin.writeRunLog = async () => "log.json";
  const erased = [];
  const attachment = {
    key: "ATTACH",
    id: 1,
    isAttachment: () => true,
    eraseTx: async () => erased.push("attachment")
  };
  const parent = {
    key: "PARENT",
    id: 2,
    isAttachment: () => false,
    eraseTx: async () => erased.push("parent")
  };
  const moved = {
    originalPath: "C:\\inbox\\paper.pdf",
    path: "D:\\papers\\staged.pdf",
    currentPath: "D:\\papers\\staged.pdf",
    moved: true
  };
  const record = { status: "in_progress" };
  await plugin.rollbackOperation(
    { records: [] },
    record,
    [attachment, parent],
    [moved],
    new Map()
  );
  assert.equal(record.status, "rolled_back");
  assert.equal(record.recoveryRequired, false);
  assert.equal(existing.has(normalize("C:\\inbox\\paper.pdf")), true);
  assert.deepEqual(erased, ["attachment", "parent"]);
  assert.equal(moves.length, 1);
}

async function main() {
  await testFlatInboxPdfsBecomeSeparateArticles();
  await testBatchPreviewIsCompact();
  await testClassifications();
  await testBoundedNames();
  await testBatchDeduplication();
  await testDiskDuplicateIsReusedButLinkedDuplicateIsSkipped();
  await testExclusiveOperation();
  await testRecognitionFailureFallsBack();
  await testReusedPrimaryIsNotMovedOrRenamed();
  await testRollback();
  console.log("paper-importer tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
