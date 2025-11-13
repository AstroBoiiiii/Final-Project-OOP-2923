document.addEventListener('DOMContentLoaded', () => {
    // -------------------- Element References --------------------
    const searchBtn = document.getElementById('searchBtn');
    const animeInput = document.getElementById('animeInput');
    const searchType = document.getElementById('searchType');
    const watchlistBtn = document.getElementById('watchlistBtn');
    const homeBtn = document.getElementById('homeBtn');
    const searchResults = document.getElementById('searchResults');

    // -------------------- Navigation --------------------
    homeBtn.addEventListener('click', () => {
        window.electronAPI.goHome();
    });

    watchlistBtn.addEventListener('click', () => {
        window.electronAPI.navigateTo('watchlist.html');
    });
    // -------------------- Search Functions --------------------
    function handleSearch() {
        const query = animeInput.value.trim();
        if (!query) {
            alert('Please enter a search term.');
            return;
        }
        
        localStorage.setItem('searchQuery', query);
        localStorage.setItem('searchType', searchType.value);
        loadSearchResults();
    }

    function handleEnterKey(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    }

    // -------------------- Load Search Results --------------------
    async function loadSearchResults() {
        const query = localStorage.getItem('searchQuery');
        const type = localStorage.getItem('searchType') || 'anime';
        
        if (!query) {
            searchResults.innerHTML = '<div class="no-results">Enter a search term to find anime or manga</div>';
            return;
        }

        // Set UI to reflect current search
        animeInput.value = query;
        searchType.value = type;
        searchResults.innerHTML = '<div class="loading">Searching...</div>';

        try {
            const response = await fetch(`https://api.jikan.moe/v4/${type}?q=${encodeURIComponent(query)}&limit=20`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            displaySearchResults(data.data, type);

        } catch (err) {
            console.error('Search error:', err);
            searchResults.innerHTML = '<div class="error">Error fetching data. Please try again.</div>';
        }
    }

    function displaySearchResults(results, type) {
        searchResults.innerHTML = '';
        
        if (!results || results.length === 0) {
            searchResults.innerHTML = '<div class="no-results">No results found. Try a different search term.</div>';
            return;
        }

        results.forEach(item => {
            const card = document.createElement('div');
            card.className = 'anime-card';
            
            // Get status with appropriate styling
            const statusClass = getStatusClass(item.status);
            const statusText = getStatusText(item.status);
            
            card.innerHTML = `
                <img src="${item.images?.jpg?.image_url || ''}" 
                    alt="${item.title}"
                    onerror="this.src='https://via.placeholder.com/140x200?text=No+Image'">
                <div class="anime-title">${item.title}</div>
                <div class="anime-info">
                    ${item.score ? `<div class="anime-score">${item.score}</div>` : ''}
                    ${type === 'anime' && item.episodes ? `<div class="anime-episodes">${item.episodes} episodes</div>` : ''}
                    ${type === 'manga' && item.chapters ? `<div class="anime-episodes">${item.chapters} chapters</div>` : ''}
                    ${item.type ? `<div class="anime-type">${item.type}</div>` : ''}
                    ${item.status ? `<div class="anime-status ${statusClass}">${statusText}</div>` : ''}
                    ${item.year ? `<div class="anime-year">${item.year}</div>` : ''}
                </div>
            `;

            card.addEventListener('click', () => {
                // Save complete data for details page
                localStorage.setItem('selectedAnime', JSON.stringify(item));
                window.electronAPI.navigateTo('details.html');
            });

            searchResults.appendChild(card);
        });
    }

    // Helper function to get status class for styling
    function getStatusClass(status) {
        if (!status) return '';
        
        const statusLower = status.toLowerCase();
        if (statusLower.includes('airing') || statusLower.includes('publishing')) return 'airing';
        if (statusLower.includes('finished') || statusLower.includes('complete')) return 'complete';
        if (statusLower.includes('upcoming') || statusLower.includes('not yet')) return 'upcoming';
        return '';
    }

    // Helper function to get readable status text
    function getStatusText(status) {
        if (!status) return 'Unknown';
        
        const statusMap = {
            'Currently Airing': 'Airing',
            'Finished Airing': 'Complete',
            'Not yet aired': 'Upcoming',
            'Upcoming': 'Upcoming',
            'Publishing': 'Publishing',
            'Finished': 'Complete',
            'Complete': 'Complete'
        };
        
        return statusMap[status] || status;
    }

    // -------------------- Event Listeners --------------------
    searchBtn.addEventListener('click', handleSearch);
    animeInput.addEventListener('keypress', handleEnterKey);

    // -------------------- Fix Dropdown Click Issue --------------------
    searchType.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    
    searchType.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // -------------------- Search Type Change Handler --------------------
    searchType.addEventListener('change', () => {
        // Clear results when switching between anime/manga
        searchResults.innerHTML = '<div class="no-results">Change detected. Enter a new search.</div>';
        animeInput.value = '';
        localStorage.removeItem('searchQuery');
    });

    // -------------------- Initialize --------------------
    // Focus search input on page load
    setTimeout(() => {
        animeInput.focus();
    }, 100);
    
    // Load previous search results if any
    loadSearchResults();
});