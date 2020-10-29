/* global psl */

const PIXIV_CONTAINER_DETAILS = {
  name: "Pixiv",
  color: "blue",
  icon: "fence"
};

const PIXIV_DOMAINS = [
  "www.pixiv.net", "pixiv.net",
  "imp.pixiv.net",

  "accounts.pixiv.net", "oauth.secure.pixiv.net",

  "policies.pixiv.net",

  "novel.pixiv.net",

  "bungei.pixiv.net", "pixiv-bungei.net",

  "sketch.pixiv.net",

  "comic.pixiv.net",

  "factory.pixiv.net",

  "sensei.pixiv.net",

  "pay.pixiv.net",

  "dic.pixiv.net",
  "en-dic.pixiv.net",

  "source.pixiv.net",


  "vroid.com",
  "hub.vroid.com",

  "pawoo.net",
  "img.pawoo.net",
  
  "booth.pm",
  "api.booth.pm",
  "asset.booth.pm",

  "www.fanbox.cc", "fanbox.cc",
  "api.fanbox.cc",

  "www.pixivision.net", "pixivision.net",

  "www.pixiv.help", "pixiv.help",
  "vroid.pixiv.help",
  "fanbox.pixiv.help",
  "booth.pixiv.help",
  "comic.pixiv.help",
  "novel.pixiv.help",
  "sketch.pixiv.help",

  "i.pximg.net", "s.pximg.net",
  "img-novel.pximg.net",
  "img-sketch.pximg.net",
  "public-img-comic.pximg.net",
  "vroid-hub.pximg.net",
  "booth.pximg.net",
  "pixiv.pximg.net"
];

const MAC_ADDON_ID = "@testpilot-containers";

let macAddonEnabled = false;
let pixivCookieStoreId = null;

// TODO: refactor canceledRequests and tabsWaitingToLoad into tabStates
const canceledRequests = {};
const tabsWaitingToLoad = {};
const tabStates = {};

const pixivHostREs = [];

async function isMACAddonEnabled () {
  try {
    const macAddonInfo = await browser.management.get(MAC_ADDON_ID);
    if (macAddonInfo.enabled) {
      sendJailedDomainsToMAC();
      return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}

async function setupMACAddonListeners () {
  browser.runtime.onMessageExternal.addListener((message, sender) => {
    if (sender.id !== "@testpilot-containers") {
      return;
    }
    switch (message.method) {
    case "MACListening":
      sendJailedDomainsToMAC();
      break;
    }
  });
  function disabledExtension (info) {
    if (info.id === MAC_ADDON_ID) {
      macAddonEnabled = false;
    }
  }
  function enabledExtension (info) {
    if (info.id === MAC_ADDON_ID) {
      macAddonEnabled = true;
    }
  }
  browser.management.onInstalled.addListener(enabledExtension);
  browser.management.onEnabled.addListener(enabledExtension);
  browser.management.onUninstalled.addListener(disabledExtension);
  browser.management.onDisabled.addListener(disabledExtension);
}

async function sendJailedDomainsToMAC () {
  try {
    return await browser.runtime.sendMessage(MAC_ADDON_ID, {
      method: "jailedDomains",
      urls: PIXIV_DOMAINS.map((domain) => {
        return `https://${domain}/`;
      })
    });
  } catch (e) {
    // We likely might want to handle this case: https://github.com/mozilla/contain-facebook/issues/113#issuecomment-380444165
    return false;
  }
}

async function getMACAssignment (url) {
  if (!macAddonEnabled) {
    return false;
  }

  try {
    const assignment = await browser.runtime.sendMessage(MAC_ADDON_ID, {
      method: "getAssignment",
      url
    });
    return assignment;
  } catch (e) {
    return false;
  }
}

function cancelRequest (tab, options) {
  // we decided to cancel the request at this point, register canceled request
  canceledRequests[tab.id] = {
    requestIds: {
      [options.requestId]: true
    },
    urls: {
      [options.url]: true
    }
  };

  // since webRequest onCompleted and onErrorOccurred are not 100% reliable
  // we register a timer here to cleanup canceled requests, just to make sure we don't
  // end up in a situation where certain urls in a tab.id stay canceled
  setTimeout(() => {
    if (canceledRequests[tab.id]) {
      delete canceledRequests[tab.id];
    }
  }, 2000);
}

function shouldCancelEarly (tab, options) {
  // we decided to cancel the request at this point
  if (!canceledRequests[tab.id]) {
    cancelRequest(tab, options);
  } else {
    let cancelEarly = false;
    if (canceledRequests[tab.id].requestIds[options.requestId] ||
        canceledRequests[tab.id].urls[options.url]) {
      // same requestId or url from the same tab
      // this is a redirect that we have to cancel early to prevent opening two tabs
      cancelEarly = true;
    }
    // register this requestId and url as canceled too
    canceledRequests[tab.id].requestIds[options.requestId] = true;
    canceledRequests[tab.id].urls[options.url] = true;
    if (cancelEarly) {
      return true;
    }
  }
  return false;
}

function generatePixivHostREs () {
  for (let pixivDomain of PIXIV_DOMAINS) {
    pixivHostREs.push(new RegExp(`^(.*\\.)?${pixivDomain}$`));
  }
}

async function clearPixivCookies () {
  // Clear all pixiv cookies
  const containers = await browser.contextualIdentities.query({});
  containers.push({
    cookieStoreId: "firefox-default"
  });

  let macAssignments = [];
  if (macAddonEnabled) {
    const promises = PIXIV_DOMAINS.map(async pixivDomain => {
      const assigned = await getMACAssignment(`https://${pixivDomain}/`);
      return assigned ? pixivDomain : null;
    });
    macAssignments = await Promise.all(promises);
  }

  PIXIV_DOMAINS.map(async pixivDomain => {
    const pixivCookieUrl = `https://${pixivDomain}/`;

    // dont clear cookies for pixivDomain if mac assigned (with or without www.)
    if (macAddonEnabled &&
        (macAssignments.includes(pixivDomain) ||
         macAssignments.includes(`www.${pixivDomain}`))) {
      return;
    }

    containers.map(async container => {
      const storeId = container.cookieStoreId;
      if (storeId === pixivCookieStoreId) {
        // Don't clear cookies in the Pixiv Container
        return;
      }

      const cookies = await browser.cookies.getAll({
        domain: pixivDomain,
        storeId
      });

      cookies.map(cookie => {
        browser.cookies.remove({
          name: cookie.name,
          url: pixivCookieUrl,
          storeId
        });
      });
      // Also clear Service Workers as it breaks detecting onBeforeRequest
      await browser.browsingData.remove({hostnames: [pixivDomain]}, {serviceWorkers: true});
    });
  });
}

async function setupContainer () {
  // Use existing Pixiv container, or create one

  const info = await browser.runtime.getBrowserInfo();
  if (parseInt(info.version) < 67) {
    PIXIV_CONTAINER_DETAILS.color = "blue";
    PIXIV_CONTAINER_DETAILS.icon = "briefcase";
  }

  const contexts = await browser.contextualIdentities.query({name: PIXIV_CONTAINER_DETAILS.name});
  if (contexts.length > 0) {
    const pixivContext = contexts[0];
    pixivCookieStoreId = pixivContext.cookieStoreId;
    // Make existing Pixiv container the "fence" icon if needed
    if (pixivContext.color !== PIXIV_CONTAINER_DETAILS.color ||
        pixivContext.icon !== PIXIV_CONTAINER_DETAILS.icon
    ) {
      await browser.contextualIdentities.update(
        pixivCookieStoreId,
        { color: PIXIV_CONTAINER_DETAILS.color, icon: PIXIV_CONTAINER_DETAILS.icon }
      );
    }
  } else {
    const context = await browser.contextualIdentities.create(PIXIV_CONTAINER_DETAILS);
    pixivCookieStoreId = context.cookieStoreId;
  }
  // Initialize domainsAddedToPixivContainer if needed
  const fbcStorage = await browser.storage.local.get();
  if (!fbcStorage.domainsAddedToPixivContainer) {
    await browser.storage.local.set({"domainsAddedToPixivContainer": []});
  }
}

async function maybeReopenTab (url, tab, request) {
  const macAssigned = await getMACAssignment(url);
  if (macAssigned) {
    // We don't reopen MAC assigned urls
    return;
  }
  const cookieStoreId = await shouldContainInto(url, tab);
  if (!cookieStoreId) {
    // Tab doesn't need to be contained
    return;
  }

  if (request && shouldCancelEarly(tab, request)) {
    // We need to cancel early to prevent multiple reopenings
    return {cancel: true};
  }

  await browser.tabs.create({
    url,
    cookieStoreId,
    active: tab.active,
    index: tab.index,
    windowId: tab.windowId
  });
  browser.tabs.remove(tab.id);

  return {cancel: true};
}

const rootDomainCache = {};

function getRootDomain(url) {
  if (url in rootDomainCache) {
    // After storing 128 entries, it will delete the oldest each time.
    const returnValue = rootDomainCache[url];
    if (Object.keys(rootDomainCache).length > 128) {
      delete rootDomainCache[(Object.keys(rootDomainCache)[0])];
    }
    return returnValue;
  }

  const urlObject = new URL(url);
  if (urlObject.hostname === "") { return false; }
  const parsedUrl = psl.parse(urlObject.hostname);

  rootDomainCache[url] = parsedUrl.domain;
  return parsedUrl.domain;

}

function isPixivURL (url) {
  const parsedUrl = new URL(url);
  for (let pixivHostRE of pixivHostREs) {
    if (pixivHostRE.test(parsedUrl.host)) {
      return true;
    }
  }
  return false;
}

// TODO: refactor parsedUrl "up" so new URL doesn't have to be called so much
// TODO: refactor fbcStorage "up" so browser.storage.local.get doesn't have to be called so much
async function addDomainToPixivContainer (url) {
  const fbcStorage = await browser.storage.local.get();
  const rootDomain = getRootDomain(url);
  fbcStorage.domainsAddedToPixivContainer.push(rootDomain);
  await browser.storage.local.set({"domainsAddedToPixivContainer": fbcStorage.domainsAddedToPixivContainer});
}

async function removeDomainFromPixivContainer (domain) {
  const fbcStorage = await browser.storage.local.get();
  const domainIndex = fbcStorage.domainsAddedToPixivContainer.indexOf(domain);
  fbcStorage.domainsAddedToPixivContainer.splice(domainIndex, 1);
  await browser.storage.local.set({"domainsAddedToPixivContainer": fbcStorage.domainsAddedToPixivContainer});
}

async function isAddedToPixivContainer (url) {
  const fbcStorage = await browser.storage.local.get();
  const rootDomain = getRootDomain(url);
  if (fbcStorage.domainsAddedToPixivContainer.includes(rootDomain)) {
    return true;
  }
  return false;
}

async function shouldContainInto (url, tab) {
  if (!url.startsWith("http")) {
    // we only handle URLs starting with http(s)
    return false;
  }

  const hasBeenAddedToPixivContainer = await isAddedToPixivContainer(url);

  if (isPixivURL(url) || hasBeenAddedToPixivContainer) {
    if (tab.cookieStoreId !== pixivCookieStoreId) {
      // Pixiv-URL outside of Pixiv Container Tab
      // Should contain into Pixiv Container
      return pixivCookieStoreId;
    }
  } else if (tab.cookieStoreId === pixivCookieStoreId) {
    // Non-Pixiv-URL inside Pixiv Container Tab
    // Should contain into Default Container
    return "firefox-default";
  }

  return false;
}

async function maybeReopenAlreadyOpenTabs () {
  const tabsOnUpdated = (tabId, changeInfo, tab) => {
    if (changeInfo.url && tabsWaitingToLoad[tabId]) {
      // Tab we're waiting for switched it's url, maybe we reopen
      delete tabsWaitingToLoad[tabId];
      maybeReopenTab(tab.url, tab);
    }
    if (tab.status === "complete" && tabsWaitingToLoad[tabId]) {
      // Tab we're waiting for completed loading
      delete tabsWaitingToLoad[tabId];
    }
    if (!Object.keys(tabsWaitingToLoad).length) {
      // We're done waiting for tabs to load, remove event listener
      browser.tabs.onUpdated.removeListener(tabsOnUpdated);
    }
  };

  // Query for already open Tabs
  const tabs = await browser.tabs.query({});
  tabs.map(async tab => {
    if (tab.url === "about:blank") {
      if (tab.status !== "loading") {
        return;
      }
      // about:blank Tab is still loading, so we indicate that we wait for it to load
      // and register the event listener if we haven't yet.
      //
      // This is a workaround until platform support is implemented:
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1447551
      // https://github.com/mozilla/multi-account-containers/issues/474
      tabsWaitingToLoad[tab.id] = true;
      if (!browser.tabs.onUpdated.hasListener(tabsOnUpdated)) {
        browser.tabs.onUpdated.addListener(tabsOnUpdated);
      }
    } else {
      // Tab already has an url, maybe we reopen
      maybeReopenTab(tab.url, tab);
    }
  });
}

function stripFbclid(url) {
  const strippedUrl = new URL(url);
  strippedUrl.searchParams.delete("fbclid");
  return strippedUrl.href;
}

async function getActiveTab () {
  const [activeTab] = await browser.tabs.query({currentWindow: true, active: true});
  return activeTab;
}

async function windowFocusChangedListener (windowId) {
  if (windowId !== browser.windows.WINDOW_ID_NONE) {
    const activeTab = await getActiveTab();
    updateBrowserActionIcon(activeTab);
  }
}

function tabUpdateListener (tabId, changeInfo, tab) {
  updateBrowserActionIcon(tab);
}

/*
async function areAllStringsTranslated () {
  const browserUILanguage = browser.i18n.getUILanguage();
  if (browserUILanguage && browserUILanguage.startsWith("en")) {
    return true;
  }
  const enMessagesPath = browser.extension.getURL("_locales/en/messages.json");
  const resp = await fetch(enMessagesPath);
  const enMessages = await resp.json();

  // TODO: Check Pontoon for available translations instead of checking
  // messages files
  for (const key of Object.keys(enMessages)){
    // TODO: this doesn't check if the add-on messages are translated into
    // any other browser.i18n.getAcceptedLanguages() options ... but then,
    // I don't think browser.i18n let's us get messages in anything but the
    // primary language anyway? Does browser.i18n.getMessage automatically
    // check for secondary languages?
    const enMessage = enMessages[key].message;
    const translatedMessage = browser.i18n.getMessage(key);
    if (translatedMessage == enMessage) {
      return false;
    }
  }
  return true;
}
*/

async function updateBrowserActionIcon (tab) {

  browser.browserAction.setBadgeText({text: ""});

  const url = tab.url;
  const hasBeenAddedToPixivContainer = await isAddedToPixivContainer(url);
  const aboutPageURLCheck = url.startsWith("about:");

  if (isPixivURL(url)) {
    // TODO: change panel logic from browser.storage to browser.runtime.onMessage
    // so the panel.js can "ask" background.js which panel it should show
    browser.storage.local.set({"CURRENT_PANEL": "on-pixiv"});
    browser.browserAction.setPopup({tabId: tab.id, popup: "./panel.html"});
  } else if (hasBeenAddedToPixivContainer) {
    browser.storage.local.set({"CURRENT_PANEL": "in-fbc"});
  } else if (aboutPageURLCheck) {
    // Sets CURRENT_PANEL if current URL is an internal about: page
    browser.storage.local.set({"CURRENT_PANEL": "about"});
  } else {
    const tabState = tabStates[tab.id];
    const panelToShow = (tabState && tabState.trackersDetected) ? "trackers-detected" : "no-trackers";
    browser.storage.local.set({"CURRENT_PANEL": panelToShow});
    browser.browserAction.setPopup({tabId: tab.id, popup: "./panel.html"});
    browser.browserAction.setBadgeBackgroundColor({color: "#6200A4"});
    if ( panelToShow === "trackers-detected" ) {
      browser.browserAction.setBadgeText({text: "!"});
    }
  }
}

async function containPixiv (request) {
  if (tabsWaitingToLoad[request.tabId]) {
    // Cleanup just to make sure we don't get a race-condition with startup reopening
    delete tabsWaitingToLoad[request.tabId];
  }

  // Listen to requests and open Pixiv into its Container,
  // open other sites into the default tab context
  if (request.tabId === -1) {
    // Request doesn't belong to a tab
    return;
  }

  const tab = await browser.tabs.get(request.tabId);
  updateBrowserActionIcon(tab);

  const url = new URL(request.url);
  const urlSearchParm = new URLSearchParams(url.search);
  if (urlSearchParm.has("fbclid")) {
    return {redirectUrl: stripFbclid(request.url)};
  }

  return maybeReopenTab(request.url, tab, request);
}

// Lots of this is borrowed from old blok code:
// https://github.com/mozilla/blok/blob/master/src/js/background.js
async function blockPixivSubResources (requestDetails) {
  if (requestDetails.type === "main_frame") {
    tabStates[requestDetails.tabId] = { trackersDetected: false };
    return {};
  }

  if (typeof requestDetails.originUrl === "undefined") {
    return {};
  }

  const urlIsPixiv = isPixivURL(requestDetails.url);
  const originUrlIsPixiv = isPixivURL(requestDetails.originUrl);

  if (!urlIsPixiv) {
    return {};
  }

  if (originUrlIsPixiv) {
    const message = {msg: "pixiv-domain"};
    // Send the message to the content_script
    browser.tabs.sendMessage(requestDetails.tabId, message);
    return {};
  }

  const hasBeenAddedToPixivContainer = await isAddedToPixivContainer(requestDetails.originUrl);

  if ( urlIsPixiv && !originUrlIsPixiv ) {
    if (!hasBeenAddedToPixivContainer ) {
      const message = {msg: "blocked-pixiv-subresources"};
      // Send the message to the content_script
      browser.tabs.sendMessage(requestDetails.tabId, message);

      tabStates[requestDetails.tabId] = { trackersDetected: true };
      return {cancel: true};
    } else {
      const message = {msg: "allowed-pixiv-subresources"};
      // Send the message to the content_script
      browser.tabs.sendMessage(requestDetails.tabId, message);
      return {};
    }
  }
  return {};
}

function setupWebRequestListeners() {
  browser.webRequest.onCompleted.addListener((options) => {
    if (canceledRequests[options.tabId]) {
      delete canceledRequests[options.tabId];
    }
  },{urls: ["<all_urls>"], types: ["main_frame"]});
  browser.webRequest.onErrorOccurred.addListener((options) => {
    if (canceledRequests[options.tabId]) {
      delete canceledRequests[options.tabId];
    }
  },{urls: ["<all_urls>"], types: ["main_frame"]});

  // Add the main_frame request listener
  browser.webRequest.onBeforeRequest.addListener(containPixiv, {urls: ["<all_urls>"], types: ["main_frame"]}, ["blocking"]);

  // Add the sub-resource request listener
  browser.webRequest.onBeforeRequest.addListener(blockPixivSubResources, {urls: ["<all_urls>"]}, ["blocking"]);
}

function setupWindowsAndTabsListeners() {
  browser.tabs.onUpdated.addListener(tabUpdateListener);
  browser.tabs.onRemoved.addListener(tabId => delete tabStates[tabId] );
  browser.windows.onFocusChanged.addListener(windowFocusChangedListener);
}

(async function init () {
  await setupMACAddonListeners();
  macAddonEnabled = await isMACAddonEnabled();

  try {
    await setupContainer();
  } catch (error) {
    // TODO: Needs backup strategy
    // See https://github.com/mozilla/contain-facebook/issues/23
    // Sometimes this add-on is installed but doesn't get a pixivCookieStoreId ?
    // eslint-disable-next-line no-console
    console.error(error);
    return;
  }
  clearPixivCookies();
  generatePixivHostREs();
  setupWebRequestListeners();
  setupWindowsAndTabsListeners();

  async function messageHandler(request, sender) {
    switch (request.message) {
    case "what-sites-are-added":
      return browser.storage.local.get().then(fbcStorage => fbcStorage.domainsAddedToPixivContainer);
    case "remove-domain-from-list":
      removeDomainFromPixivContainer(request.removeDomain).then( results => results );
      break;
    case "add-domain-to-list":
      addDomainToPixivContainer(sender.url).then( results => results);
      break;
    case "get-root-domain":
      return getRootDomain(request.url);
    default:
      throw new Error("Unexpected message!");
    }
  }

  browser.runtime.onMessage.addListener(messageHandler);

  maybeReopenAlreadyOpenTabs();

  const activeTab = await getActiveTab();
  updateBrowserActionIcon(activeTab);
})();
