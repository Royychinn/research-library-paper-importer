var ResearchLibraryPaperImporter;
var chromeHandle;

function log(msg) {
  Zotero.debug("Research Library Paper Importer: " + msg);
}

function install() {
  log("Installed");
}

async function startup({ id, version, rootURI, resourceURI }) {
  log("Starting");
  if (!rootURI) {
    rootURI = resourceURI.spec;
  }

  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "researchlibrarypaperimporter", rootURI + "chrome/content/"],
  ]);

  Services.scriptloader.loadSubScript(rootURI + "paper-importer.js");
  ResearchLibraryPaperImporter.init({ id, version, rootURI });
  ResearchLibraryPaperImporter.addToAllWindows();
}

function onMainWindowLoad({ window }) {
  ResearchLibraryPaperImporter?.addToWindow(window);
}

function onMainWindowUnload({ window }) {
  ResearchLibraryPaperImporter?.removeFromWindow(window);
}

function shutdown({ id, version, rootURI, resourceURI } = {}) {
  log("Shutting down");
  ResearchLibraryPaperImporter?.removeFromAllWindows();
  try {
    ResearchLibraryPaperImporter?.shutdown();
  } catch (e) {
    Zotero.logError(e);
  }
  ResearchLibraryPaperImporter = undefined;
  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

function uninstall() {
  log("Uninstalled");
}
