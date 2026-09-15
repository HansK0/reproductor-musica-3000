const { app, BrowserWindow, Notification, ipcMain, dialog, nativeImage } = require("electron");
const path = require("path");
const { readdir } = require("fs/promises");
const { parseFile } = require("music-metadata");

let win;
let isPlayingState = false; 
const isDev = !app?.isPackaged;
app.setAppUserModelId('com.tuapp.reproductor');

const icons = {
    previous: nativeImage.createFromPath(path.join(__dirname, 'assets/thumb-previous.png')),
    next: nativeImage.createFromPath(path.join(__dirname, 'assets/thumb-next.png')),
    play: nativeImage.createFromPath(path.join(__dirname, 'assets/thumb-play.png')),
    pause: nativeImage.createFromPath(path.join(__dirname, 'assets/thumb-pause.png')),
};

const Store = require('electron-store');
const store = new Store({
    cwd: isDev ? path.join(__dirname, 'test') : undefined,
    name: 'configAPP',
    defaults: {
        audioFormats: [".mp3",".wav",".ogg",".oga",".aac",".m4a",".flac",".opus",".webm"],
        libraryPaths: [],
        songs: [],
        lastSession: {
            volume: 0.5,
            shuffle: false,
            loop: false,
            lastPath: null
        }
  }
});

function renderThumbar() {
    win.setThumbarButtons([
        {
            tooltip: 'Anterior',
            icon: icons.previous,
            click: () => win.webContents.send('thumbar-action', 'previous'),
        },
        {
            tooltip: isPlayingState ? 'Pausar' : 'Reproducir',
            icon: isPlayingState ? icons.pause : icons.play,
            click: () => win.webContents.send('thumbar-action', 'play-pause'),
        },
        {
            tooltip: 'Siguiente',
            icon: icons.next,
            click: () => win.webContents.send('thumbar-action', 'next'),
        },
    ]);
}


async function openFileSystem(typeScan) {
    try{
        console.log('Escaneando carpeta de canciones...');
        const result = await dialog.showOpenDialog({  
            title: 'Selecciona la carpeta de canciones',
            buttonLabel: 'Escanear', // TODO: hacer el escaneo despues de seleccionar la carpeta, no en el click del menú
            properties: typeScan, //['openDirectory'],
            //filters: [{name: 'Songs', extensions: AUDIO_FORMATS}]
        });
        console.log('Resultados del escaneo de carpeta o cancion/es: ',result)
        return result
    }catch(err){
        console.log(`Ocurrio un Error en 'OpenFileSystem()': ${err.message}`)
    }
}

async function scanSongs(event, typeScan = ['']){
    console.log('scanSongs: ', event, typeScan)
    try {
        console.log('Abriendo diálogo de selección...');
        const result = await openFileSystem(typeScan);

        if (result?.canceled || !result?.filePaths || result.filePaths.length === 0) {
            console.log('El usuario cancelo la seleccion de carpeta.');
            return null;
        }

        const formatArray = store.get('audioFormats') || [".mp3", ".wav", ".ogg", ".oga", ".aac", ".m4a", ".flac", ".opus", ".webm"];
        const allowedFormats = new Set(formatArray.map(ext => ext.toLocaleLowerCase()));

        let songsToProcess = [];
        let basePath = '';

        if (typeScan.includes('openDirectory')){

            basePath = result.filePaths[0];
            await store.set('libraryPaths', basePath); 

            const files = await readdir(basePath);

            const filteredFiles = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return allowedFormats.has(ext);
            })

            songsToProcess = filteredFiles.map(file => ({
                name: file,
                fullPath: path.join(basePath, file)
            }));

        } else if (typeScan.includes('openFile')) {
            const filteredFilePaths = result.filePaths.filter(filePath => {
                const ext = path.extname(filePath).toLocaleLowerCase();
                return allowedFormats.has(ext);
            })

            basePath = path.dirname(result.filePaths[0])

            songsToProcess = filteredFilePaths.map(filePath => ({
                name: path.basename(filePath),
                fullPath: filePath
            }));
        }

        const filesFiltered = await Promise.all(
            songsToProcess.map(async (song) => {
                try{
                    const metadata = await parseFile(song.fullPath);
                    return {
                        path: song.fullPath,
                        name: song.name,
                        duration: metadata?.format?.duration || 0
                    };
                }catch(metaError){
                    console.error(`Error procesando metadatos de ${song.name}:`, metaError);
                    return {
                        path: song.fullPath,
                        name: song.name,
                        duration: 0
                    };
                }
            })
        );

        const currentSongs = store.get('songs');
        const allSongs = [...currentSongs, ...filesFiltered]

        const uniqueSongs = Array.from(
            new Map(allSongs.map(song => [song.path.toLowerCase(), song])).values()
        );
        await store.set('songs', uniqueSongs); 

        return {songs: uniqueSongs, path: basePath }
        
    } catch (error) {
        console.error('Error al escanear la carpeta de canciones:', error);
    }
}

function createWindow() {
    const mainWindow = new BrowserWindow({

        width: 1200,
        height: 800,
        resizable: true,

        icon: path.join(__dirname, "assets", "icon.png"),
        webPreferences: {
            preload: path.join(__dirname, "preload.js")
        },
        contextIsolation: true,
        nodeIntegration: false,

        titleBarStyle: 'hidden'
    });

    mainWindow.webContents.openDevTools();
    //setMainMenu(mainWindow);
    mainWindow.loadFile("renderer/index.html");

    mainWindow.webContents.once('did-finish-load', () => {
        renderThumbar();
    });

    return mainWindow
}

app.whenReady().then(() => {
    //Menu
    ipcMain.on('minimizeApp', (event) => { BrowserWindow.fromWebContents(event.sender).minimize() });
    ipcMain.on('maximizeApp', function(event){
        const win = BrowserWindow.fromWebContents(event.sender)
        win.isMaximized() ? win.unmaximize() :win.maximize();
    });
    ipcMain.on('closeApp', () => { app.quit() });

    ipcMain.handle('store:get', (_event, key) => store.get(key));
    ipcMain.handle('store:set', (_event, key, value) => store.set(key, value));
    ipcMain.handle('store:delete', (_event, key) => store.delete(key));
    
    ipcMain.handle('scanSongs', async (_event, typeOpen) => { return scanSongs(_event, typeOpen) });
    ipcMain.on('openDevTools', (event) => { 
        const win = BrowserWindow.fromWebContents(event.sender);
        (isDev ? win.webContents.toggleDevTools() : console.log('nada') );
    });

    ipcMain.handle('song:delete', (_event, pathToDelete) => {
        const currentSongs = store.get('songs', []);
        const filtered = currentSongs.filter(song => song.path !== pathToDelete);
        store.set('songs', filtered);
        return filtered;
    });
    
    ipcMain.on('playback-state-changed', (_event, playing) => {
        isPlayingState = playing;
        renderThumbar();
    });

    win = createWindow();
    
    const n = new Notification({
        title: 'Titulo de Notificación!',
        subtitle: 'Sub titulo!',
        body: 'cuerpo!'
    })
    n.on('show', () => console.log('Notification shown!'))
    n.on('click', () => console.log('Notification clicked!'))

    n.show()
    console.log(store.path)
})