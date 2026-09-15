// ============================================================
// DOM references
// ============================================================
const totalSongsLabel = document.getElementById('librarySongs');
const totalTimeLabel = document.getElementById('totalTime');
const currentTimeLabel = document.getElementById('currentTime');

const addSongButton = document.getElementById('addSong');
const addFolderButton = document.getElementById('addFolder');

const minimizeButton = document.getElementById('minimize');
const maximizeButton = document.getElementById('maximize');
const closeButton = document.getElementById('close');

const shuffleButton = document.getElementById('typeReproducer');
const playPauseButton = document.getElementById('playPause');
const loopButton = document.getElementById('loop');
const progressBar = document.getElementById('progress');
const volumeInput = document.getElementById('volume');
const volumeIcon = document.getElementById('iconVolume');
const skipNextButton = document.getElementById('skipNext');
const skipPreviousButton = document.getElementById('skipPrevious');
const currentSongTitle = document.getElementById('titleCurrentSong');
const songListBody = document.getElementById('songList');

const contextMenu = document.getElementById('contextMenu');
const deleteSongButton = document.getElementById('deleteSong');

// ============================================================
// Icon markup (Lucide, inline SVG)
// ============================================================
const ICONS = {
    play: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>',
    pause: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>'
};

// ============================================================
// State
// ============================================================
const audio = new Audio();
let isPlaying = false;
let currentSongIndex = false;
let currentMaxSongIndex = undefined;
let currentSongRow = undefined;
let songToDelete = null;
let lastSession;
let toastTimeoutId;

// ============================================================
// Toast / validation helpers
// ============================================================
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.hidden = false;

    requestAnimationFrame(() => toast.classList.add('visible'));

    clearTimeout(toastTimeoutId);
    toastTimeoutId = setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => { toast.hidden = true; }, 200);
    }, 2500);
}

function hasValidSong(message = 'Selecciona una canción primero') {
    const valid = typeof currentSongIndex === 'number' && currentSongIndex >= 0 && songListBody.rows.length > 0;
    if (!valid) showToast(message);
    return valid;
}

// ============================================================
// Session persistence
// ============================================================
async function updateSession(partial) {
    lastSession = { ...lastSession, ...partial };
    await window.electronAPI.set('lastSession', lastSession);
}

// ============================================================
// Rendering helpers
// ============================================================
function updateTableSongs(songs) {
    const table = songListBody.closest('table');
    const emptyState = document.getElementById('emptyState');

    songListBody.innerHTML = '';

    if (!songs || songs.length === 0) {
        table.style.display = 'none';
        emptyState.hidden = false;
        currentMaxSongIndex = undefined;
        updateTotalSongs(0);
        return;
    }

    table.style.display = '';
    emptyState.hidden = true;

    songs.forEach((song, index) => {
        const row = document.createElement('tr');
        row.insertCell(0).textContent = song.name.substring(0, song.name.lastIndexOf('.'));
        row.insertCell(1).textContent = song.duration
            ? `${Math.floor(song.duration / 60)}:${String(Math.floor(song.duration % 60)).padStart(2, '0')}`
            : '0:00';
        row.insertCell(2).textContent = song.name.substring(song.name.lastIndexOf('.') + 1);
        row.dataset.path = song.path;

        if (song.path === lastSession?.lastPath) {
            currentSongIndex = index;
        }

        songListBody.appendChild(row);
    });

    currentMaxSongIndex = songs.length - 1;

    if (typeof currentSongIndex === 'number' && currentSongIndex >= 0) {
        currentSongRow = songListBody.rows[currentSongIndex];
        currentSongRow.classList.add('active');
        updateTotalTime(currentSongRow.cells[1].textContent);
        audio.src = currentSongRow.dataset.path;
        updateSongInfo();
    }

    updateTotalSongs(songs.length);
}

function updateSongInfo() {
    if (isPlaying) {
        audio.play();
    } else {
        audio.pause();
    }
    currentSongTitle.textContent = currentSongRow ? currentSongRow.cells[0].textContent : 'Ninguna canción seleccionada';
}

function updateTotalSongs(count) {
    totalSongsLabel.textContent = count;
}

function updateTotalTime(value) {
    totalTimeLabel.textContent = value;
}

function updateCurrentTime(value) {
    currentTimeLabel.textContent = `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}

function updateProgressFill(element, propertyName) {
    const percent = ((element.value - element.min) / (element.max - element.min)) * 100;
    element.style.setProperty(propertyName, `${percent}%`);
}

// ============================================================
// Window controls
// ============================================================
minimizeButton.addEventListener('click', () => {
    window.electronAPI.minimizeApp();
});
maximizeButton.addEventListener('click', () => {
    window.electronAPI.maximizeApp();
});
closeButton.addEventListener('click', () => {
    window.electronAPI.closeApp();
});

// ============================================================
// Library scanning
// ============================================================
async function connectScanSongs(scanType = []) {
    const response = await window.electronAPI.onScanSongs(scanType);
    if (response) {
        updateTableSongs(response.songs);
    } else {
        console.warn('El escaneo no se realizó correctamente:', response);
    }
}

addSongButton.addEventListener('click', async () => {
    await connectScanSongs(['openFile', 'multiSelections']);
});
addFolderButton.addEventListener('click', async () => {
    await connectScanSongs(['openDirectory']);
});

// ============================================================
// Shuffle
// ============================================================
shuffleButton.onclick = async () => {
    const isShuffleActive = shuffleButton.dataset.value === 'shuffle';

    if (isShuffleActive) {
        shuffleButton.dataset.value = 'default';
        shuffleButton.classList.remove('active');
        await updateSession({ shuffle: false });
    } else {
        shuffleButton.dataset.value = 'shuffle';
        shuffleButton.classList.add('active');
        await updateSession({ shuffle: true });
    }
};

// ============================================================
// Playback: ended / navigation
// ============================================================
audio.addEventListener('ended', () => {
    if (shuffleButton.dataset.value === 'default') {
        if (currentSongIndex < currentMaxSongIndex) {
            currentSongIndex++;
        } else {
            currentSongIndex = 0;
        }
    } else {
        currentSongIndex = Math.floor(Math.random() * (currentMaxSongIndex + 1));
    }

    if (currentSongRow) {
        currentSongRow.classList.remove('active');
    }
    currentSongRow = songListBody.rows[currentSongIndex];
    currentSongRow.classList.add('active');
    updateTotalTime(currentSongRow.cells[1].textContent);
    audio.src = currentSongRow.dataset.path;
    updateSession({ lastPath: currentSongRow.dataset.path });
    updateSongInfo();

    if (!document.hasFocus()) {
        new Notification('Ahora suena', { body: currentSongRow.cells[0].textContent });
    }
});

songListBody.addEventListener('click', (event) => {
    if (event.target.tagName === 'TD' && !event.target.closest('tr').classList.contains('empty-state')) {
        const row = event.target.closest('tr');

        audio.src = row.dataset.path;
        updateSession({ lastPath: row.dataset.path });

        if (currentSongRow) {
            currentSongRow.classList.remove('active');
        }
        row.classList.add('active');
        currentSongIndex = row.rowIndex - 1;
        currentSongRow = row;
        updateTotalTime(currentSongRow.cells[1].textContent);
        updateSongInfo();
    }
});

// ============================================================
// Context menu (right click -> delete song)
// ============================================================
document.addEventListener('click', () => {
    contextMenu.classList.remove('visible');
});

songListBody.addEventListener('contextmenu', (event) => {
    event.preventDefault();

    const row = event.target.closest('tr');
    if (!row || row.classList.contains('empty-state') || !row.dataset.path) return;

    songToDelete = row;
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.classList.add('visible');
});

contextMenu.addEventListener('click', (event) => event.stopPropagation());

deleteSongButton.addEventListener('click', async () => {
    if (!songToDelete) return;

    const deletedPath = songToDelete.dataset.path;
    const wasCurrentSong = currentSongRow && currentSongRow.dataset.path === deletedPath;
    const deletedIndex = songToDelete.rowIndex - 1;

    await window.electronAPI.deleteSong(deletedPath);

    songToDelete.remove();
    contextMenu.classList.remove('visible');
    songToDelete = null;

    currentMaxSongIndex = songListBody.rows.length - 1;

    if (songListBody.rows.length === 0) {
        document.querySelector('#tableContainer table').style.display = 'none';
        document.getElementById('emptyState').hidden = false;
        audio.pause();
        audio.src = '';
        currentSongTitle.textContent = 'Ninguna canción seleccionada';
        currentSongRow = undefined;
        currentSongIndex = false;
    } else if (wasCurrentSong) {
        if (shuffleButton.dataset.value === 'shuffle') {
            currentSongIndex = Math.floor(Math.random() * (currentMaxSongIndex + 1));
        } else {
            currentSongIndex = deletedIndex > currentMaxSongIndex ? 0 : deletedIndex;
        }

        currentSongRow = songListBody.rows[currentSongIndex];
        currentSongRow.classList.add('active');
        audio.src = currentSongRow.dataset.path;
        updateTotalTime(currentSongRow.cells[1].textContent);
        updateSongInfo();
    } else if (currentSongRow && currentSongRow.isConnected) {
        currentSongIndex = currentSongRow.rowIndex - 1;
    }

    updateTotalSongs(songListBody.rows.length);
});

// ============================================================
// Keyboard shortcuts
// ============================================================
document.addEventListener('keydown', (event) => {
    if (!audio) return;

    if (event.key === 'ArrowRight') {
        audio.currentTime += 5;
    }
    if (event.key === 'ArrowLeft') {
        audio.currentTime -= 5;
    }
    if (event.key === 'F12') {
        window.electronAPI.openDevTools();
    }
    if (event.key === ' ' || event.key === 'Space') {
        playPauseButton.dispatchEvent(new Event('click'));
    }
});

// ============================================================
// Playback controls
// ============================================================
window.electronAPI.onThumbarAction((action) => {
    if (action === 'play-pause') {
        playPauseButton.dispatchEvent(new Event('click'));
    } else if (action === 'next') {
        skipNextButton.dispatchEvent(new Event('click'));
    } else if (action === 'previous') {
        skipPreviousButton.dispatchEvent(new Event('click'));
    }
});
audio.addEventListener('play', () => {
    window.electronAPI.notifyPlaybackState(true);
});

audio.addEventListener('pause', () => {
    window.electronAPI.notifyPlaybackState(false);
});

playPauseButton.onclick = () => {
    if (!hasValidSong('No hay ninguna canción seleccionada para reproducir')) return;
    if (!audio.src) return;

    if (audio.paused) {
        audio.play();
        playPauseButton.innerHTML = ICONS.pause;
        isPlaying = true;
    } else {
        audio.pause();
        playPauseButton.innerHTML = ICONS.play;
        isPlaying = false;
    }
};

skipPreviousButton.onclick = () => {
    if (!hasValidSong('Agrega canciones a tu biblioteca primero')) return;
    if (!audio.src) return;

    if (shuffleButton.dataset.value === 'default') {
        if (currentSongIndex > 0) {
            currentSongIndex--;
        } else {
            currentSongIndex = currentMaxSongIndex;
        }

        if (currentSongRow) {
            currentSongRow.classList.remove('active');
        }
        currentSongRow = songListBody.rows[currentSongIndex];
        currentSongRow.classList.add('active');
        audio.src = currentSongRow.dataset.path;
        updateSession({ lastPath: currentSongRow.dataset.path });
        updateTotalTime(currentSongRow.cells[1].textContent);
        updateSongInfo();
    } else {
        audio.dispatchEvent(new Event('ended'));
    }
};

skipNextButton.onclick = () => {
    if (!hasValidSong('Agrega canciones a tu biblioteca primero')) return;
    if (!audio.src) return;

    if (shuffleButton.dataset.value === 'default') {
        if (currentSongIndex < currentMaxSongIndex) {
            currentSongIndex++;
        } else {
            currentSongIndex = 0;
        }

        if (currentSongRow) {
            currentSongRow.classList.remove('active');
        }
        currentSongRow = songListBody.rows[currentSongIndex];
        currentSongRow.classList.add('active');
        audio.src = currentSongRow.dataset.path;
        updateSession({ lastPath: currentSongRow.dataset.path });
        updateTotalTime(currentSongRow.cells[1].textContent);
        updateSongInfo();
    } else {
        audio.dispatchEvent(new Event('ended'));
    }
};

loopButton.onclick = async () => {
    audio.loop = !audio.loop;
    loopButton.classList.toggle('active', audio.loop);
    await updateSession({ loop: audio.loop });
};

// ============================================================
// Progress bar
// ============================================================
audio.addEventListener('timeupdate', () => {
    progressBar.value = (audio.currentTime / audio.duration) * 100 || 0;
    updateCurrentTime(audio.currentTime);
    updateProgressFill(progressBar, '--progressSong-value');
});

progressBar.oninput = () => {
    if (audio.src) {
        audio.currentTime = (progressBar.value / 100) * audio.duration;
    }
};

// ============================================================
// Volume
// ============================================================
volumeInput.addEventListener('input', (event) => {
    const rawValue = Number(event.target.value);
    updateProgressFill(volumeInput, '--progressVolume-value');

    const volume = rawValue / 100;
    audio.volume = volume;

    // No hay swap de ícono por estado (mute/bajo/alto) todavía:
    // se deja un único ícono, opacidad reducida cuando está en mute.
    volumeIcon.style.opacity = volume === 0 ? 0.4 : 1;
});

volumeInput.addEventListener('change', async (event) => {
    await updateSession({ volume: event.target.value / 100 });
});

// ============================================================
// Initial load
// ============================================================
window.addEventListener('DOMContentLoaded', async () => {
    console.log(`Chrome (v${electronAPI.chrome()})\nNode.js (v${electronAPI.node()})\nElectron (v${electronAPI.electron()})`);

    try {
        lastSession = await window.electronAPI.get('lastSession');

        if (lastSession) {
            volumeInput.value = lastSession.volume * 100;
            audio.volume = lastSession.volume;
            volumeInput.dispatchEvent(new Event('input'));

            audio.loop = !!lastSession.loop;
            loopButton.classList.toggle('active', audio.loop);

            shuffleButton.dataset.value = lastSession.shuffle ? 'shuffle' : 'default';
            shuffleButton.classList.toggle('active', !!lastSession.shuffle);
        }

        const savedSongs = await window.electronAPI.get('songs');

        if (savedSongs && savedSongs.length > 0) {
            updateTableSongs(savedSongs);
        } else {
            document.querySelector('#tableContainer table').style.display = 'none';
            document.getElementById('emptyState').hidden = false;
        }
    } catch (error) {
        console.error('Error al restaurar el estado inicial:', error);
    }
});