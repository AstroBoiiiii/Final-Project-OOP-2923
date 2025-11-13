const animeList = document.getElementById('animeList');
const mangaList = document.getElementById('mangaList');
const showAnimeBtn = document.getElementById('showAnime');
const showMangaBtn = document.getElementById('showManga');
window.electronAPI.addToHistory('watchlist.html');


// Drag and drop variables
let draggedItem = null;

// -------------------- Navigation --------------------
document.getElementById('homeBtn').addEventListener('click', () => {
    window.electronAPI.goHome();
});
// -------------------- Back Button --------------------
document.getElementById('backBtn').addEventListener('click', () => {
    window.electronAPI.goBack();
});

// -------------------- Tab Switching --------------------
showAnimeBtn.addEventListener('click', () => {
    showAnimeBtn.classList.add('active');
    showMangaBtn.classList.remove('active');
    animeList.style.display = 'flex';
    mangaList.style.display = 'none';
});

showMangaBtn.addEventListener('click', () => {
    showMangaBtn.classList.add('active');
    showAnimeBtn.classList.remove('active');
    mangaList.style.display = 'flex';
    animeList.style.display = 'none';
});

// -------------------- Watchlist Management --------------------
function createAnimeCard(anime, isManga = false) {
    const card = document.createElement('div');
    card.className = 'anime-item';
    card.draggable = true;
    card.setAttribute('data-title', anime.title);

    const totalEpisodes = anime.totalEpisodes || anime.episodes || 'Unknown';
    const watchedEpisodes = anime.watchedEpisodes || 0;
    const currentSeason = anime.currentSeason || 'Season 1';
    const customSeason = anime.customSeason || '';
    const customEpisodes = anime.customEpisodes || '';
    const notes = anime.notes || '';
    
    const hasProperEpisodes = totalEpisodes !== 'Unknown' && !isNaN(parseInt(totalEpisodes));
    const isCompleted = hasProperEpisodes && watchedEpisodes >= parseInt(totalEpisodes);
    
    const currentSeasonEpisodes = anime.seasonEpisodes ? anime.seasonEpisodes[currentSeason] : null;

    card.innerHTML = `
    <img src="${anime.image || anime.imageUrl || 'https://via.placeholder.com/80x120?text=No+Image'}" 
        alt="${anime.title}" 
        class="anime-image"
        onerror="this.src='https://via.placeholder.com/80x120?text=No+Image'">
    <div class="anime-info">
        <h3>${anime.title}</h3>
        
        <!-- Progress Bar + Episode Info - Only show if episodes are known -->
        ${anime.totalEpisodes && anime.totalEpisodes !== 'Unknown' && !isNaN(parseInt(anime.totalEpisodes)) ? `
            <div class="progress-section">
                ${createProgressBar(anime.watchedEpisodes, anime.totalEpisodes)}
                <div class="episode-count">
                    ${anime.watchedEpisodes || 0}/${anime.totalEpisodes} episodes
                    ${calculateProgressPercentage(anime.watchedEpisodes, anime.totalEpisodes) > 0 ? 
                        ` • ${calculateProgressPercentage(anime.watchedEpisodes, anime.totalEpisodes)}%` : ''
                    }
                </div>
            </div>
        ` : ''}
            
            ${hasProperEpisodes ? `
                <div class="season-tracker">
                    <div class="season-header">
                        <select class="season-dropdown">
                            ${(anime.seasons && anime.seasons.length > 0 ? 
                                (isManga ? anime.seasons.map(s => s.replace('Season', 'Volume')) : anime.seasons) 
                                : [isManga ? 'Volume 1' : 'Season 1'])
                                .map(season => 
                                    `<option value="${isManga ? season.replace('Volume', 'Season') : season}" ${currentSeason === (isManga ? season.replace('Volume', 'Season') : season) ? 'selected' : ''}>
                                        ${season}
                                    </option>`
                                ).join('')}
                        </select>
                    </div>
                    <div class="episode-grid" id="episodes-${anime.title.replace(/\s+/g, '-')}">
                        ${currentSeasonEpisodes ? 
                            currentSeasonEpisodes.map(episode => `
                                <label class="episode-checkbox">
                                    <input type="checkbox" ${episode.watched ? 'checked' : ''} 
                                        data-episode="${episode.number}">
                                    <span>${episode.number}</span>
                                </label>
                            `).join('') : 
                            '<p>No episodes data</p>'
                        }
                    </div>
                </div>
            ` : `
                <div class="custom-tracker">
                    <div class="custom-inputs">
                        <input type="text" class="custom-season" placeholder="${isManga ? 'Volume/Arc' : 'Season/Arc'}" value="${customSeason}">
                        <input type="text" class="custom-episodes" placeholder="${isManga ? 'Chapters' : 'Episodes'}" value="${customEpisodes}">
                    </div>
                </div>
            `}
            
            ${anime.score ? `<p>Score: ${anime.score}</p>` : ''}
            ${anime.rating ? `<p>Rating: ${anime.rating}/10</p>` : ''}
            
            <div class="notes-section">
                <textarea class="notes-textarea" placeholder="Add notes...">${notes}</textarea>
            </div>
        </div>
        <div class="anime-actions">
            <button class="action-btn delete-btn">✕</button>
        </div>
    `;

    // Image click to go to details page
    const animeImage = card.querySelector('.anime-image');
    animeImage.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        // If we have mal_id, fetch complete data from API
        if (anime.mal_id) {
            try {
                console.log('🔄 Fetching complete data for:', anime.title);
                
                // Determine if it's manga or anime
                const isMangaItem = anime.type === 'manga' || isManga;
                const endpoint = isMangaItem ? 'manga' : 'anime';
                
                const response = await fetch(`https://api.jikan.moe/v4/${endpoint}/${anime.mal_id}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.data) {
                    // Add type information to the data
                    data.data.type = isMangaItem ? 'manga' : 'anime';
                    // Save complete data to localStorage
                    localStorage.setItem('selectedAnime', JSON.stringify(data.data));
                    console.log('✅ Complete data saved for details page');
                } else {
                    // Fallback: use existing watchlist data
                    console.log('⚠️ No API data found, using watchlist data');
                    localStorage.setItem('selectedAnime', JSON.stringify(anime));
                }
            } catch (error) {
                console.error('❌ Error fetching details:', error);
                // Fallback: use existing watchlist data
                localStorage.setItem('selectedAnime', JSON.stringify(anime));
            }
        } else {
            // No mal_id available, use existing watchlist data
            console.log('ℹ️ No MAL ID, using watchlist data');
            localStorage.setItem('selectedAnime', JSON.stringify(anime));
        }
        
        window.electronAPI.navigateTo('details.html');
    });

    if (hasProperEpisodes) {
        // Season dropdown handler
        const seasonDropdown = card.querySelector('.season-dropdown');
        seasonDropdown.addEventListener('change', async (e) => {
            e.stopPropagation();
            const result = await window.electronAPI.updateSeason(anime.title, e.target.value);
            if (result.success) {
                anime.currentSeason = e.target.value;
                loadWatchlist();
            }
        });

        // Episode checkbox handlers
        const episodeCheckboxes = card.querySelectorAll('.episode-checkbox input');

        // Setup double click functionality
        setupDoubleClickEpisode(episodeCheckboxes, anime.title, currentSeason);

        // Setup single click functionality
        episodeCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', async (e) => {
                e.stopPropagation();
                const episodeNumber = parseInt(e.target.dataset.episode);
                const result = await window.electronAPI.updateEpisodeStatus(
                    anime.title, 
                    currentSeason, 
                    episodeNumber, 
                    e.target.checked
                );
                if (result.success) {
                    // Update progress bar immediately
                    updateProgressBar(card, result.watchedCount, totalEpisodes);
                    
                    if (result.watchedCount >= parseInt(totalEpisodes)) {
                        loadWatchlist();
                    }
                }
            });
        });

    } else {
        // Custom fields handlers
        const customSeasonInput = card.querySelector('.custom-season');
        const customEpisodesInput = card.querySelector('.custom-episodes');
        
        const updateCustomFields = async () => {
            const result = await window.electronAPI.updateCustomFields(
                anime.title, 
                customSeasonInput.value, 
                customEpisodesInput.value
            );
            if (result.success) {
                anime.customSeason = customSeasonInput.value;
                anime.customEpisodes = customEpisodesInput.value;
            }
        };
        
        customSeasonInput.addEventListener('change', updateCustomFields);
        customEpisodesInput.addEventListener('change', updateCustomFields);
    }

    // Notes handler
    const notesTextarea = card.querySelector('.notes-textarea');
    notesTextarea.addEventListener('change', async (e) => {
        e.stopPropagation();
        const result = await window.electronAPI.updateNotes(anime.title, e.target.value);
        if (result.success) {
            anime.notes = e.target.value;
        }
    });

    // Delete button handler
    const deleteBtn = card.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Remove "${anime.title}" from watchlist?`)) {
            const result = await window.electronAPI.deleteWatchlistItem(anime.title);
            if (result.success) {
                loadWatchlist();
            }
        }
    });

    // Drag and drop handlers for reordering - WHOLE CARD IS DRAGGABLE
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('dragenter', handleDragEnter);
    card.addEventListener('dragleave', handleDragLeave);
    card.addEventListener('drop', handleDrop);
    card.addEventListener('dragend', handleDragEnd);

    return card;
}

// -------------------- Drag and Drop Functions --------------------
function handleDragStart(e) {
    // Prevent dragging if clicking interactive elements
    if (e.target.matches('input, select, textarea, button')) {
        e.preventDefault();
        return false;
    }
    
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.getAttribute('data-title'));
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    e.preventDefault();
    if (this !== draggedItem) {
        this.style.border = '2px solid #007bff';
        this.style.borderRadius = '10px';
    }
}

function handleDragLeave(e) {
    this.style.border = '1px solid #ddd';
    this.style.borderRadius = '8px';
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    this.style.border = '1px solid #ddd';
    this.style.borderRadius = '8px';
    
    if (draggedItem !== this && draggedItem) {
        const container = this.closest('.watchlist-list');
        const items = Array.from(container.querySelectorAll('.anime-item'));
        
        const draggedIndex = items.indexOf(draggedItem);
        const targetIndex = items.indexOf(this);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
            if (draggedIndex < targetIndex) {
                container.insertBefore(draggedItem, this.nextSibling);
            } else {
                container.insertBefore(draggedItem, this);
            }
            
            updateListOrder(container.id);
        }
    }
    
    return false;
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    
    // Reset all items' styles
    const items = document.querySelectorAll('.anime-item');
    items.forEach(item => {
        item.style.border = '1px solid #ddd';
        item.style.borderRadius = '8px';
    });
    
    draggedItem = null;
}

async function updateListOrder(listId) {
    try {
        const container = document.getElementById(listId);
        const items = Array.from(container.querySelectorAll('.anime-item'));
        const titles = items.map(item => item.getAttribute('data-title'));
        
        const result = await window.electronAPI.updateWatchlistOrder(titles);
        if (!result.success) {
            console.error('Error updating order:', result.message);
        }
    } catch (error) {
        console.error('Error in updateListOrder:', error);
    }
}

// -------------------- Double Click Episode Handler --------------------
function setupDoubleClickEpisode(episodeCheckboxes, animeTitle, currentSeason) {
    episodeCheckboxes.forEach(checkbox => {
        let clickTimer = null;
        
        checkbox.addEventListener('click', (e) => {
            // Handle single click (existing functionality)
            if (clickTimer === null) {
                clickTimer = setTimeout(() => {
                    // Single click - let the existing change event handle it
                    clickTimer = null;
                }, 300); // 300ms delay to detect double click
            } else {
                // Double click detected
                clearTimeout(clickTimer);
                clickTimer = null;
                e.preventDefault();
                
                const clickedEpisode = parseInt(checkbox.dataset.episode);
                const cardElement = checkbox.closest('.anime-item');
                handleEpisodeDoubleClick(episodeCheckboxes, clickedEpisode, animeTitle, currentSeason, cardElement);
            }
        });
    });
}

async function handleEpisodeDoubleClick(episodeCheckboxes, clickedEpisode, animeTitle, currentSeason, cardElement) {
    const clickedCheckbox = Array.from(episodeCheckboxes).find(cb => 
        parseInt(cb.dataset.episode) === clickedEpisode
    );
    
    if (!clickedCheckbox) return;
    
    const shouldMarkAsWatched = !clickedCheckbox.checked;
    
    // Get all episodes up to and including the clicked one
    const episodesToUpdate = Array.from(episodeCheckboxes)
        .filter(cb => parseInt(cb.dataset.episode) <= clickedEpisode)
        .sort((a, b) => parseInt(a.dataset.episode) - parseInt(b.dataset.episode));
    
    try {
        let totalWatched = 0;
        
        // Update episodes one by one
        for (const cb of episodesToUpdate) {
            const episodeNumber = parseInt(cb.dataset.episode);
            const result = await window.electronAPI.updateEpisodeStatus(
                animeTitle,
                currentSeason,
                episodeNumber,
                shouldMarkAsWatched
            );
            
            if (!result.success) {
                console.error(`Failed to update episode ${episodeNumber}`);
                loadWatchlist();
                return;
            }
            
            totalWatched = result.watchedCount;
            cb.checked = shouldMarkAsWatched;
        }
        
        // Update progress bar immediately after all episodes are updated
        updateProgressBar(cardElement, totalWatched, getTotalEpisodesFromCard(cardElement));
        
    } catch (error) {
        console.error('Error updating episodes:', error);
        loadWatchlist();
    }
}

// Helper function to get total episodes from card
function getTotalEpisodesFromCard(cardElement) {
    const episodeCountText = cardElement.querySelector('.episode-count')?.textContent;
    if (episodeCountText) {
        const match = episodeCountText.match(/\d+\/(\d+)/);
        return match ? match[1] : 'Unknown';
    }
    return 'Unknown';
}

// -------------------- Progress Helper Functions --------------------
function createProgressBar(watched, total) {
    const percentage = calculateProgressPercentage(watched, total);
    const progressBarWidth = 100;
    const filledWidth = Math.round((percentage / 100) * progressBarWidth);
    const emptyWidth = progressBarWidth - filledWidth;
    
    return `
        <div class="progress-bar">
            <div class="progress-filled" style="width: ${filledWidth}%"></div>
            <div class="progress-empty" style="width: ${emptyWidth}%"></div>
        </div>
    `;
}

function calculateProgressPercentage(watched, total) {
    if (!watched || !total || total === 'Unknown' || isNaN(parseInt(total))) {
        return 0;
    }
    
    const watchedNum = parseInt(watched);
    const totalNum = parseInt(total);
    
    if (totalNum === 0) return 0;
    
    return Math.round((watchedNum / totalNum) * 100);
}

// -------------------- Progress Bar Update Function --------------------
function updateProgressBar(cardElement, watchedEpisodes, totalEpisodes) {
    const progressSection = cardElement.querySelector('.progress-section');
    if (!progressSection) return; // No progress bar to update
    
    const progressBar = progressSection.querySelector('.progress-bar');
    const episodeCount = progressSection.querySelector('.episode-count');
    
    if (progressBar && episodeCount) {
        // Update progress bar
        const percentage = calculateProgressPercentage(watchedEpisodes, totalEpisodes);
        const filledWidth = Math.round((percentage / 100) * 100);
        const emptyWidth = 100 - filledWidth;
        
        progressBar.innerHTML = `
            <div class="progress-filled" style="width: ${filledWidth}%"></div>
            <div class="progress-empty" style="width: ${emptyWidth}%"></div>
        `;
        
        // Update episode count text
        episodeCount.textContent = `${watchedEpisodes}/${totalEpisodes} episodes${percentage > 0 ? ` • ${percentage}%` : ''}`;
    }
}

// -------------------- Load Watchlist --------------------
async function loadWatchlist() {
    try {
        const watchlist = await window.electronAPI.loadWatchlist();
        
        animeList.innerHTML = '';
        mangaList.innerHTML = '';

        if (!watchlist || watchlist.length === 0) {
            animeList.innerHTML = '<p style="padding: 20px; text-align: center;">No anime in watchlist yet.</p>';
            mangaList.innerHTML = '<p style="padding: 20px; text-align: center;">No manga in watchlist yet.</p>';
            return;
        }

        const animeItems = watchlist.filter(item => item.type === 'anime' || !item.type);
        const mangaItems = watchlist.filter(item => item.type === 'manga');

        const sortItems = (items) => {
            return items.sort((a, b) => {
                const aHasEpisodes = (a.totalEpisodes || a.episodes) !== 'Unknown' && !isNaN(parseInt(a.totalEpisodes || a.episodes));
                const bHasEpisodes = (b.totalEpisodes || b.episodes) !== 'Unknown' && !isNaN(parseInt(b.totalEpisodes || b.episodes));
                
                const aCompleted = aHasEpisodes && (a.watchedEpisodes || 0) >= parseInt(a.totalEpisodes || a.episodes);
                const bCompleted = bHasEpisodes && (b.watchedEpisodes || 0) >= parseInt(b.totalEpisodes || b.episodes);
                
                if (aCompleted && !bCompleted) return 1;
                if (!aCompleted && bCompleted) return -1;
                return (a.order || 0) - (b.order || 0);
            });
        };

        const sortedAnimeItems = sortItems(animeItems);

        // Display anime
        if (sortedAnimeItems.length > 0) {
            sortedAnimeItems.forEach(anime => {
                const card = createAnimeCard(anime, false);
                animeList.appendChild(card);
            });
        } else {
            animeList.innerHTML = '<p style="padding: 20px; text-align: center;">No anime in watchlist yet.</p>';
        }

        // Display manga
        if (mangaItems.length > 0) {
            mangaItems.forEach(manga => {
                const card = createAnimeCard(manga, true);
                mangaList.appendChild(card);
            });
        } else {
            mangaList.innerHTML = '<p style="padding: 20px; text-align: center;">No manga in watchlist yet.</p>';
        }

    } catch (error) {
        console.error('Error loading watchlist:', error);
        animeList.innerHTML = '<p style="color: red; padding: 20px; text-align: center;">Error loading watchlist</p>';
        mangaList.innerHTML = '<p style="color: red; padding: 20px; text-align: center;">Error loading watchlist</p>';
    }
}

// -------------------- Initialize --------------------
function initializeWatchlist() {
    loadWatchlist();
    setupEventListeners();
}

// Load watchlist when page loads
window.addEventListener('DOMContentLoaded', initializeWatchlist);

// Also reload when page becomes visible (when navigating back from home)
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        loadWatchlist();
    }
});

// Force reload when the page is shown (alternative method)
window.addEventListener('focus', function() {
    loadWatchlist();
});

