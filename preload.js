const { contextBridge, ipcRenderer } = require('electron');

// Navigation history using localStorage (persists across page loads)
const getNavigationHistory = () => {
    try {
        const history = localStorage.getItem('navigationHistory');
        return history ? JSON.parse(history) : ['index.html'];
    } catch {
        return ['index.html'];
    }
};

const setNavigationHistory = (history) => {
    localStorage.setItem('navigationHistory', JSON.stringify(history));
};

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Navigation methods with history tracking
    navigateTo: (page) => {
        const navigationHistory = getNavigationHistory();
        
        // Add to history if it's a different page
        if (navigationHistory[navigationHistory.length - 1] !== page) {
            navigationHistory.push(page);
            setNavigationHistory(navigationHistory);
            console.log('Navigation history:', navigationHistory);
        }
        ipcRenderer.send('navigate-to', page);
    },
    
    // Add current page to history without navigating
    addToHistory: (page) => {
        const navigationHistory = getNavigationHistory();
        
        if (navigationHistory[navigationHistory.length - 1] !== page) {
            navigationHistory.push(page);
            setNavigationHistory(navigationHistory);
            console.log('Added to history:', page, 'Current history:', navigationHistory);
        }
    },
    
    goHome: () => {
        setNavigationHistory(['index.html']);
        ipcRenderer.send('navigate-to', 'index.html');
    },
    
    // Back navigation
    goBack: () => {
        const navigationHistory = getNavigationHistory();
        console.log('Current history before back:', navigationHistory);
        
        if (navigationHistory.length > 1) {
            // Remove current page
            navigationHistory.pop();
            setNavigationHistory(navigationHistory);
            
            // Go to previous page
            const previousPage = navigationHistory[navigationHistory.length - 1];
            console.log('Going back to:', previousPage);
            ipcRenderer.send('navigate-to', previousPage);
        } else {
            // Fallback to home
            setNavigationHistory(['index.html']);
            ipcRenderer.send('navigate-to', 'index.html');
        }
    },
    
    // Debug method
    getNavigationHistory: () => {
        return getNavigationHistory();
    },
    
    // Watchlist methods
    saveWatchlistItem: (item) => ipcRenderer.invoke('save-watchlist-item', item),
    getWatchlist: () => ipcRenderer.invoke('load-watchlist'),
    loadWatchlist: () => ipcRenderer.invoke('load-watchlist'),
    deleteWatchlistItem: (title) => ipcRenderer.invoke('delete-watchlist-item', title),
    updateEpisodeStatus: (title, season, episodeNumber, watched) => 
        ipcRenderer.invoke('update-episode-status', title, season, episodeNumber, watched),
    updateSeason: (title, season) => ipcRenderer.invoke('update-season', title, season),
    updateWatchlistOrder: (newOrder) => ipcRenderer.invoke('update-watchlist-order', newOrder),
    updateNotes: (title, notes) => ipcRenderer.invoke('update-notes', title, notes),
    updateCustomFields: (title, customSeason, customEpisodes) => 
        ipcRenderer.invoke('update-custom-fields', title, customSeason, customEpisodes),

    saveReview: (malId, reviews) => ipcRenderer.invoke('save-review', malId, reviews),
    loadReviews: (malId) => ipcRenderer.invoke('load-reviews', malId),

    // Utility methods
    on: (channel, callback) => {
        const validChannels = ['menu-navigation'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, callback);
        }
    },
    
    off: (channel, callback) => {
        const validChannels = ['menu-navigation'];
        if (validChannels.includes(channel)) {
            ipcRenderer.off(channel, callback);
        }
    }
});

// Expose app version and environment
contextBridge.exposeInMainWorld('appInfo', {
    version: process.env.npm_package_version || '1.0.0',
    platform: process.platform,
    isDev: process.env.NODE_ENV === 'development'
});
