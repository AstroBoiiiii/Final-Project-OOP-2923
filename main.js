const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

// Constants
const DATA_DIR = path.join(__dirname, 'data');
const WATCHLIST_FILE = path.join(DATA_DIR, 'watchlist.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

let navigationHistory = ['index.html'];

class AnimeTrackerApp {
    constructor() {
        this.mainWindow = null;
        this.init();
    }

    async init() {
        // Ensure data directory exists
        await this.ensureDataDirectory();
        
        // Set up app event handlers
        this.setupAppHandlers();
    }

    async ensureDataDirectory() {
        try {
            await fs.access(DATA_DIR);
        } catch {
            await fs.mkdir(DATA_DIR, { recursive: true });
        }
    }

    setupAppHandlers() {
        app.whenReady().then(() => {
            this.createMainWindow();
            this.setupMenu();
        });

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                this.createMainWindow();
            }
        });
    }

    createMainWindow() {
        this.mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            minWidth: 800,
            minHeight: 600,
            show: false,
            icon: process.platform !== 'darwin' ? path.join(__dirname, 'assets', 'icon.png') : undefined,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
                enableRemoteModule: false,
                sandbox: false
            }
        });

        // Load the main page
        this.mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

        // Show window when ready to prevent visual flash
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
            
            // Open DevTools in development
            if (process.env.NODE_ENV === 'development') {
                this.mainWindow.webContents.openDevTools();
            }
        });

        // Handle window closed
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });
    }

    setupMenu() {
        const template = [
            {
                label: 'File',
                submenu: [
                    {
                        label: 'Reload',
                        accelerator: 'CmdOrCtrl+R',
                        click: () => {
                            this.mainWindow.reload();
                        }
                    },
                    {
                        label: 'Force Reload',
                        accelerator: 'CmdOrCtrl+Shift+R',
                        click: () => {
                            this.mainWindow.webContents.reloadIgnoringCache();
                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'Exit',
                        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                        click: () => {
                            app.quit();
                        }
                    }
                ]
            },
            {
                label: 'View',
                submenu: [
                    { role: 'reload' },
                    { role: 'forceReload' },
                    { role: 'toggleDevTools' },
                    { type: 'separator' },
                    { role: 'resetZoom' },
                    { role: 'zoomIn' },
                    { role: 'zoomOut' },
                    { type: 'separator' },
                    { role: 'togglefullscreen' }
                ]
            },
            {
                label: 'Navigation',
                submenu: [
                    {
                        label: 'Home',
                        accelerator: 'CmdOrCtrl+1',
                        click: () => {
                            this.navigateTo('index.html');
                        }
                    },
                    {
                        label: 'Watchlist',
                        accelerator: 'CmdOrCtrl+2',
                        click: () => {
                            this.navigateTo('watchlist.html');
                        }
                    },
                    {
                        label: 'Search',
                        accelerator: 'CmdOrCtrl+3',
                        click: () => {
                            this.navigateTo('search.html');
                        }
                    }
                ]
            }
        ];

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }

    navigateTo(page) {
        if (this.mainWindow) {
            this.mainWindow.loadFile(path.join(__dirname, 'renderer', page));
        }
    }
}

// Data Management Functions
class DataManager {
    static async loadWatchlist() {
        try {
            await fs.access(WATCHLIST_FILE);
            const data = await fs.readFile(WATCHLIST_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            console.error('Error loading watchlist:', error);
            return [];
        }
    }

    static async saveWatchlist(data) {
        try {
            await fs.writeFile(WATCHLIST_FILE, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving watchlist:', error);
            throw error;
        }
    }

    static validateAnimeItem(item) {
        if (!item.title) {
            throw new Error('Title is required');
        }

        // Only set essential defaults, preserve all other data
        return {
            ...item,
            id: item.id || `${item.title}-${Date.now()}`,
            title: item.title.trim(),
            watchedEpisodes: item.watchedEpisodes || 0,
            order: item.order || 0,
            isCompleted: item.isCompleted || false,
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }
}


// IPC Handlers
ipcMain.handle('load-watchlist', async (event) => {
    try {
        console.log('🔄 Loading watchlist from file...');
        const watchlist = await DataManager.loadWatchlist();
        console.log('📋 Watchlist data loaded:', watchlist);
        return watchlist;
    } catch (error) {
        console.error('❌ Error loading watchlist:', error);
        return [];
    }
});

ipcMain.handle('save-watchlist-item', async (event, item) => {
    try {
        const watchlist = await DataManager.loadWatchlist();
        const validatedItem = DataManager.validateAnimeItem(item);

        // Check for duplicates by title
        const existingIndex = watchlist.findIndex(w => w.title === validatedItem.title);
        
        if (existingIndex !== -1) {
            // Update existing item
            watchlist[existingIndex] = { 
                ...watchlist[existingIndex], 
                ...validatedItem,
                id: watchlist[existingIndex].id, // Keep original ID
                createdAt: watchlist[existingIndex].createdAt // Keep original creation date
            };
        } else {
            // Add new item
            watchlist.push(validatedItem);
        }

        await DataManager.saveWatchlist(watchlist);
        return { success: true, message: existingIndex !== -1 ? 'Item updated' : 'Added to watchlist' };
    } catch (error) {
        console.error('Error saving watchlist item:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('update-episode-status', async (event, title, season, episodeNumber, watched) => {
    try {
        const watchlist = await DataManager.loadWatchlist();
        const itemIndex = watchlist.findIndex(item => item.title === title);
        
        if (itemIndex === -1) {
            return { success: false, message: 'Item not found' };
        }

        // Initialize seasonEpisodes if it doesn't exist
        if (!watchlist[itemIndex].seasonEpisodes) {
            watchlist[itemIndex].seasonEpisodes = {};
        }
        if (!watchlist[itemIndex].seasonEpisodes[season]) {
            watchlist[itemIndex].seasonEpisodes[season] = [];
        }

        // Find or create the episode
        let episodeIndex = watchlist[itemIndex].seasonEpisodes[season].findIndex(ep => ep.number === episodeNumber);
        if (episodeIndex === -1) {
            watchlist[itemIndex].seasonEpisodes[season].push({ 
                number: episodeNumber, 
                watched: watched 
            });
        } else {
            watchlist[itemIndex].seasonEpisodes[season][episodeIndex].watched = watched;
        }

        // Calculate total watched episodes
        let totalWatched = 0;
        Object.values(watchlist[itemIndex].seasonEpisodes).forEach(seasonEpisodes => {
            seasonEpisodes.forEach(episode => {
                if (episode.watched) totalWatched++;
            });
        });

        watchlist[itemIndex].watchedEpisodes = totalWatched;
        watchlist[itemIndex].isCompleted = totalWatched >= parseInt(watchlist[itemIndex].totalEpisodes || 0);
        watchlist[itemIndex].updatedAt = new Date().toISOString();

        await DataManager.saveWatchlist(watchlist);
        return { success: true, watchedCount: totalWatched };
    } catch (error) {
        console.error('Error updating episode status:', error);
        return { success: false, message: 'Error updating episode status' };
    }
});

ipcMain.handle('delete-watchlist-item', async (event, title) => {
    try {
        const watchlist = await DataManager.loadWatchlist();
        const updatedWatchlist = watchlist.filter(item => item.title !== title);
        await DataManager.saveWatchlist(updatedWatchlist);
        return { success: true };
    } catch (error) {
        console.error('Error deleting watchlist item:', error);
        return { success: false, message: 'Error deleting item' };
    }
});

ipcMain.handle('update-watchlist-order', async (event, newOrder) => {
    try {
        const watchlist = await DataManager.loadWatchlist();
        const reorderedWatchlist = newOrder.map((title, index) => {
            const item = watchlist.find(item => item.title === title);
            return item ? { ...item, order: index } : null;
        }).filter(Boolean);

        await DataManager.saveWatchlist(reorderedWatchlist);
        return { success: true };
    } catch (error) {
        console.error('Error updating watchlist order:', error);
        return { success: false, message: 'Error updating order' };
    }
});

// Simple handlers (kept from original)
ipcMain.handle('update-season', async (event, title, season) => {
    try {
        const watchlist = await DataManager.loadWatchlist();
        const itemIndex = watchlist.findIndex(item => item.title === title);
        
        if (itemIndex !== -1) {
            watchlist[itemIndex].currentSeason = season;
            watchlist[itemIndex].updatedAt = new Date().toISOString();
            await DataManager.saveWatchlist(watchlist);
            return { success: true };
        }
        return { success: false, message: 'Item not found' };
    } catch (error) {
        console.error('Error updating season:', error);
        return { success: false, message: 'Error updating season' };
    }
});

ipcMain.handle('update-notes', async (event, title, notes) => {
    try {
        const watchlist = await DataManager.loadWatchlist();
        const itemIndex = watchlist.findIndex(item => item.title === title);
        
        if (itemIndex !== -1) {
            watchlist[itemIndex].notes = notes;
            watchlist[itemIndex].updatedAt = new Date().toISOString();
            await DataManager.saveWatchlist(watchlist);
            return { success: true };
        }
        return { success: false, message: 'Item not found' };
    } catch (error) {
        console.error('Error updating notes:', error);
        return { success: false, message: 'Error updating notes' };
    }
});

ipcMain.handle('update-custom-fields', async (event, title, customSeason, customEpisodes) => {
    try {
        const watchlist = await DataManager.loadWatchlist();
        const itemIndex = watchlist.findIndex(item => item.title === title);
        
        if (itemIndex !== -1) {
            watchlist[itemIndex].customSeason = customSeason;
            watchlist[itemIndex].customEpisodes = customEpisodes;
            watchlist[itemIndex].updatedAt = new Date().toISOString();
            await DataManager.saveWatchlist(watchlist);
            return { success: true };
        }
        return { success: false, message: 'Item not found' };
    } catch (error) {
        console.error('Error updating custom fields:', error);
        return { success: false, message: 'Error updating custom fields' };
    }
});

// Navigation handlers
ipcMain.on('navigate-to', (event, page) => {
    const appInstance = global.appInstance;
    if (appInstance && appInstance.mainWindow) {
        // Add to history if it's a different page
        if (navigationHistory[navigationHistory.length - 1] !== page) {
            navigationHistory.push(page);
            console.log('Main process navigation history:', navigationHistory);
        }
        appInstance.mainWindow.loadFile(path.join(__dirname, 'renderer', page));
    }
});

// Add this new IPC handler for back navigation
ipcMain.on('go-back', () => {
    const appInstance = global.appInstance;
    console.log('Main process history before back:', navigationHistory);
    
    if (navigationHistory.length > 1 && appInstance && appInstance.mainWindow) {
        // Remove current page
        navigationHistory.pop();
        // Go to previous page
        const previousPage = navigationHistory[navigationHistory.length - 1];
        console.log('Main process going back to:', previousPage);
        appInstance.mainWindow.loadFile(path.join(__dirname, 'renderer', previousPage));
    } else {
        // Fallback to home
        navigationHistory = ['index.html'];
        if (appInstance && appInstance.mainWindow) {
            appInstance.mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
        }
    }
});

// Add this to get current history for debugging
ipcMain.handle('get-navigation-history', () => {
    return navigationHistory;
});

ipcMain.handle('save-review', async (event, malId, reviewData) => {
  try {
    console.log('Saving reviews for MAL ID:', malId);
    console.log('Review data received:', reviewData);
    
    // Validate inputs
    if (!malId) {
      console.error('No MAL ID provided');
      return { success: false, error: 'No MAL ID provided' };
    }
    
    if (!reviewData) {
      console.error('No review data provided');
      return { success: false, error: 'No review data provided' };
    }
    
    // Ensure reviewData is an array
    if (!Array.isArray(reviewData)) {
      console.error('Review data is not an array:', typeof reviewData);
      return { success: false, error: 'Review data must be an array' };
    }
    
    // Filter out any null or invalid entries
    const filteredReviews = reviewData.filter(review => 
      review && 
      typeof review === 'object' && 
      review.id && 
      review.rating && 
      review.text
    );
    
    console.log('Filtered reviews:', filteredReviews);

    // Create data folder path
    const dataFolder = path.join(__dirname, 'data');
    const reviewsPath = path.join(dataFolder, 'reviews.json');
    
    // Create data folder if it doesn't exist
    if (!fsSync.existsSync(dataFolder)) {
      fsSync.mkdirSync(dataFolder, { recursive: true });
    }
    
    let allReviews = {};
    
    // Load existing reviews
    if (fsSync.existsSync(reviewsPath)) {
      try {
        const data = fsSync.readFileSync(reviewsPath, 'utf8');
        allReviews = JSON.parse(data);
        console.log('Loaded existing reviews file');
      } catch (parseError) {
        console.error('Error parsing existing reviews file, creating new one:', parseError);
        allReviews = {};
      }
    }
    
    // Update reviews for this MAL ID - only if we have valid reviews
    if (filteredReviews.length > 0) {
      allReviews[malId] = filteredReviews;
    } else {
      // If no valid reviews, remove the entry
      delete allReviews[malId];
    }
    
    // Clean the entire reviews object to remove any null entries
    Object.keys(allReviews).forEach(key => {
      if (!allReviews[key] || !Array.isArray(allReviews[key]) || allReviews[key].length === 0) {
        delete allReviews[key];
      } else {
        // Clean individual review arrays
        allReviews[key] = allReviews[key].filter(review => 
          review && 
          typeof review === 'object' && 
          review.id && 
          review.rating && 
          review.text
        );
        
        // Remove the key if the array is empty after cleaning
        if (allReviews[key].length === 0) {
          delete allReviews[key];
        }
      }
    });
    
    console.log('Final reviews to save:', allReviews);
    
    // Save back to file
    fsSync.writeFileSync(reviewsPath, JSON.stringify(allReviews, null, 2));
    console.log('Reviews saved successfully');
    return { success: true };
  } catch (error) {
    console.error('Error in save-review handler:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-reviews', async (event, malId) => {
  try {
    console.log('Loading reviews for MAL ID:', malId);
    
    const dataFolder = path.join(__dirname, 'data');
    const reviewsPath = path.join(dataFolder, 'reviews.json');
    
    if (!fsSync.existsSync(reviewsPath)) {
      console.log('No reviews file found, returning empty array');
      return { success: true, reviews: [] };
    }
    
    const data = fsSync.readFileSync(reviewsPath, 'utf8');
    let allReviews;
    
    try {
      allReviews = JSON.parse(data);
    } catch (parseError) {
      console.error('Error parsing reviews file, returning empty array:', parseError);
      return { success: true, reviews: [] };
    }
    
    // Validate the structure and clean the data
    if (!allReviews || typeof allReviews !== 'object') {
      console.log('Invalid reviews structure, returning empty array');
      return { success: true, reviews: [] };
    }
    
    let reviews = allReviews[malId] || [];
    
    // Ensure it's an array and filter out any null/invalid entries
    if (!Array.isArray(reviews)) {
      console.log('Reviews for MAL ID is not an array, returning empty array');
      reviews = [];
    } else {
      reviews = reviews.filter(review => 
        review && 
        typeof review === 'object' && 
        review.id && 
        review.rating && 
        review.text
      );
    }
    
    console.log('Returning cleaned reviews:', reviews);
    return { 
      success: true, 
      reviews: reviews 
    };
  } catch (error) {
    console.error('Error in load-reviews handler:', error);
    return { success: false, error: error.message };
  }
});

// Initialize the app and make it globally available
const appInstance = new AnimeTrackerApp();
global.appInstance = appInstance;