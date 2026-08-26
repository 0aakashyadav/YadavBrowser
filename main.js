const { app, BrowserWindow, BrowserView, ipcMain, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

let win = null;
let tabs = [];
let activeTab = 0;
let privateCounter = 0;
const TOOLBAR_HEIGHT = 108;
const HOME_URL = `file://${path.join(__dirname, 'yadav-search.html')}`;

const dataDir = () => path.join(app.getPath('userData'), 'yadavbrowser-data');
const historyFile = () => path.join(dataDir(), 'history.json');
const bookmarksFile = () => path.join(dataDir(), 'bookmarks.json');
function ensureData(){fs.mkdirSync(dataDir(),{recursive:true});}
function readJson(file,fallback){try{ensureData();return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):fallback}catch{return fallback}}
function writeJson(file,value){try{ensureData();fs.writeFileSync(file,JSON.stringify(value,null,2),'utf8');return true}catch(error){console.error(error);return false}}

let historyItems = readJson(historyFile(), []);
let bookmarks = readJson(bookmarksFile(), []);
if(!Array.isArray(historyItems)) historyItems=[];
if(!Array.isArray(bookmarks)) bookmarks=[];

function active(){return tabs[activeTab] || null}
function validWebUrl(url){return url && !url.startsWith('file://') && !url.startsWith('devtools://') && !url.startsWith('about:')}
function addHistory(url,title){if(!validWebUrl(url))return;historyItems.unshift({url,title:title||url,visitedAt:new Date().toISOString()});historyItems=historyItems.slice(0,2000);writeJson(historyFile(),historyItems)}
function isBookmarked(url){return bookmarks.some(x=>x.url===url)}
function send(channel,data){if(win&&!win.isDestroyed())win.webContents.send(channel,data)}
function sendState(){const t=active();send('tab-update',{activeIndex:activeTab,tabs:tabs.map(x=>({title:x.title||'New Tab',url:x.url||'',private:Boolean(x.private)}))});send('address-update',t?t.url:'');send('bookmark-state',{url:t?t.url:'',bookmarked:!!(t&&!t.private&&isBookmarked(t.url)),private:!!(t&&t.private)});send('bookmarks-update',bookmarks)}

function normalizeUrl(input){let url=String(input||'').trim();if(!url)return '';if(/^https?:\/\//i.test(url))return url;if(/^[a-z][a-z0-9+.-]*:\/\//i.test(url))return url;if(url.includes('.')&&!url.includes(' '))return 'https://'+url;return 'https://www.google.com/search?q='+encodeURIComponent(url)}

function updateBounds(){if(!win||win.isDestroyed()||!active())return;const [width,height]=win.getContentSize();active().view.setBounds({x:0,y:TOOLBAR_HEIGHT,width,height:Math.max(0,height-TOOLBAR_HEIGHT)})}
function showActive(){if(!win||win.isDestroyed()||!active())return;win.setBrowserView(active().view);updateBounds();sendState()}

function createTab(url=HOME_URL,options={}){
  const isPrivate=Boolean(options.private);
  const partition=isPrivate?`yadav-private-${++privateCounter}-${Date.now()}`:undefined;
  const view=new BrowserView({webPreferences:{contextIsolation:true,nodeIntegration:false,partition}});
  const tab={view,url,title:isPrivate?'Private Tab':'New Tab',private:isPrivate,partition};
  tabs.push(tab);

  view.webContents.setWindowOpenHandler(({url:newUrl})=>{createNewTab(newUrl,{private:tab.private});return {action:'deny'}});
  view.webContents.on('page-title-updated',(event,title)=>{event.preventDefault();tab.title=title||(tab.private?'Private Tab':'New Tab');sendState()});
  view.webContents.on('did-start-loading',()=>{if(tabs[activeTab]===tab)send('loading-state',true)});
  view.webContents.on('did-stop-loading',()=>{if(tabs[activeTab]===tab)send('loading-state',false)});
  view.webContents.on('did-navigate',(_,newUrl)=>{tab.url=newUrl;if(!tab.private)addHistory(newUrl,tab.title);if(tabs[activeTab]===tab)sendState()});
  view.webContents.on('did-navigate-in-page',(_,newUrl)=>{tab.url=newUrl;if(tabs[activeTab]===tab)sendState()});
  view.webContents.session.on('will-download',(_,item)=>{const save=path.join(app.getPath('downloads'),item.getFilename());item.setSavePath(save);item.on('updated',(_,state)=>send('download-update',{filename:item.getFilename(),savePath:save,state,receivedBytes:item.getReceivedBytes(),totalBytes:item.getTotalBytes()}));item.once('done',(_,state)=>send('download-update',{filename:item.getFilename(),savePath:save,state,receivedBytes:item.getReceivedBytes(),totalBytes:item.getTotalBytes()}))});
  view.webContents.on('before-input-event',(event,input)=>handleShortcut(event,input));
  view.webContents.loadURL(url);
  return tab;
}

function createNewTab(url=HOME_URL,options={}){const tab=createTab(url,options);activeTab=tabs.length-1;showActive()}
function createPrivateTab(){createNewTab(HOME_URL,{private:true})}
function closeActiveTab(){if(tabs.length<=1)return;const tab=active();try{tab.view.webContents.destroy()}catch{}tabs.splice(activeTab,1);if(activeTab>=tabs.length)activeTab=tabs.length-1;showActive()}
function switchToTab(index){if(!Number.isInteger(index)||index<0||index>=tabs.length)return;activeTab=index;showActive()}
function nextTab(){if(tabs.length>1)switchToTab((activeTab+1)%tabs.length)}
function previousTab(){if(tabs.length>1)switchToTab((activeTab-1+tabs.length)%tabs.length)}
function bookmarkActive(){const t=active();if(!t||t.private||!validWebUrl(t.url))return{success:false,reason:t?.private?'private-tab':'invalid-url'};if(isBookmarked(t.url)){bookmarks=bookmarks.filter(x=>x.url!==t.url)}else{bookmarks.unshift({id:`${Date.now()}-${Math.random().toString(36).slice(2)}`,title:t.title||t.url,url:t.url,createdAt:new Date().toISOString()})}writeJson(bookmarksFile(),bookmarks);sendState();return{success:true,bookmarked:isBookmarked(t.url)}}
function focusAddress(){send('focus-address-bar')}

function handleShortcut(event,input){if(input.type!=='keyDown')return;const key=String(input.key||'').toLowerCase();if(input.control&&!input.alt&&!input.shift&&key==='t'){event.preventDefault();createNewTab();return}if(input.control&&!input.alt&&!input.shift&&key==='w'){event.preventDefault();closeActiveTab();return}if(input.control&&input.shift&&!input.alt&&key==='tab'){event.preventDefault();previousTab();return}if(input.control&&!input.shift&&!input.alt&&key==='tab'){event.preventDefault();nextTab();return}if(input.control&&!input.alt&&/^[1-9]$/.test(input.key)){event.preventDefault();switchToTab(Number(input.key)-1);return}if(input.control&&!input.alt&&!input.shift&&key==='l'){event.preventDefault();focusAddress();return}if(input.control&&!input.alt&&!input.shift&&key==='d'){event.preventDefault();bookmarkActive();return}if(input.control&&!input.alt&&!input.shift&&key==='r'){event.preventDefault();active()?.view.webContents.reload();return}if(input.control&&!input.alt&&!input.shift&&key==='h'){event.preventDefault();send('show-history',historyItems);return}}

function createWindow(){
  win=new BrowserWindow({width:1280,height:800,minWidth:900,minHeight:560,title:'YadavBrowser',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false}});
  createTab();activeTab=0;win.loadFile(path.join(__dirname,'index.html'));
  win.webContents.on('did-finish-load',()=>showActive());
  win.on('resize',updateBounds);
  win.on('closed',()=>{win=null;tabs=[];activeTab=0});
}

ipcMain.on('navigate',(_,url)=>{const t=active();if(!t)return;const target=normalizeUrl(url);if(!target)return;t.url=target;t.view.webContents.loadURL(target);send('address-update',target)});
ipcMain.on('back',()=>{const t=active();if(t?.view.webContents.canGoBack())t.view.webContents.goBack()});
ipcMain.on('forward',()=>{const t=active();if(t?.view.webContents.canGoForward())t.view.webContents.goForward()});
ipcMain.on('reload',()=>active()?.view.webContents.reload());
ipcMain.on('new-tab',()=>createNewTab());
ipcMain.on('new-private-tab',()=>createPrivateTab());
ipcMain.on('close-tab',closeActiveTab);
ipcMain.on('switch-tab',(_,index)=>{if(index==='next')nextTab();else if(index==='previous')previousTab();else switchToTab(index)});
ipcMain.on('focus-address-bar',focusAddress);
ipcMain.on('open-new-tab',(_,url)=>createNewTab(normalizeUrl(url)));
ipcMain.on('open-private-tab',(_,url)=>createNewTab(url?normalizeUrl(url):HOME_URL,{private:true}));
ipcMain.handle('bookmark:toggle',bookmarkActive);
ipcMain.handle('bookmark:list',()=>bookmarks);
ipcMain.handle('bookmark:remove',(_,url)=>{const before=bookmarks.length;bookmarks=bookmarks.filter(x=>x.url!==url);writeJson(bookmarksFile(),bookmarks);sendState();return{success:before!==bookmarks.length}});
ipcMain.handle('history:list',()=>historyItems);
ipcMain.handle('history:clear',()=>{historyItems=[];const success=writeJson(historyFile(),historyItems);send('history-update',historyItems);return{success}});
ipcMain.handle('history:remove',(_,url)=>{const before=historyItems.length;historyItems=historyItems.filter(x=>x.url!==url);const success=writeJson(historyFile(),historyItems);send('history-update',historyItems);return{success:success&&before!==historyItems.length}});
ipcMain.handle('browser:get-state',()=>({tabs:tabs.map(t=>({title:t.title,url:t.url,private:t.private})),activeIndex:activeTab,bookmarks:bookmarks.length,history:historyItems.length}));
ipcMain.handle('browser:clear-data',()=>{historyItems=[];bookmarks=[];return{success:writeJson(historyFile(),historyItems)&&writeJson(bookmarksFile(),bookmarks)}});
ipcMain.handle('downloads:path',()=>app.getPath('downloads'));

app.whenReady().then(()=>{ensureData();createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()})});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
