// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // -------------------- Element References --------------------
    const searchBtn = document.getElementById('searchBtn');
    const animeInput = document.getElementById('animeInput');
    const searchType = document.getElementById('searchType');
    const watchlistBtn = document.getElementById('watchlistBtn');
    const homeBtn = document.getElementById('homeBtn');
    
    const newAnimeList = document.getElementById('newAnimeList');
    const favoritesList = document.getElementById('favoritesList');
    const highRatedList = document.getElementById('highRatedList');

    window.electronAPI.addToHistory('index.html');

    // -------------------- Navigation --------------------
    watchlistBtn.addEventListener('click', () => {
        window.electronAPI.navigateTo('watchlist.html');
    });

    homeBtn.addEventListener('click', () => {
        // Reload the sections when home is clicked
        loadSections();
    });

    // -------------------- Search Functionality --------------------
    searchBtn.addEventListener('click', () => {
        const query = animeInput.value.trim();
        if (!query) {
            alert('Please enter an anime or manga title.');
            return;
        }

        // Save query & type to localStorage for search page
        localStorage.setItem('searchQuery', query);
        localStorage.setItem('searchType', searchType.value);

        // Go to search page
        window.electronAPI.navigateTo('search.html');
    });

    // Allow pressing Enter to search
    animeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchBtn.click();
        }
    });

    // Focus search input when page loads
    animeInput.focus();

    // -------------------- Load Homepage Sections --------------------
    async function loadSections() {
        // Show loading states
        newAnimeList.innerHTML = '<p>Loading...</p>';
        favoritesList.innerHTML = '<p>Loading...</p>';
        highRatedList.innerHTML = '<p>Loading...</p>';

        try {
            // Fetch all data in parallel for better performance
            const [newData, popularData, topData] = await Promise.all([
                fetch('https://api.jikan.moe/v4/seasons/now').then(res => res.json()),
                fetch('https://api.jikan.moe/v4/top/anime?filter=bypopularity').then(res => res.json()),
                fetch('https://api.jikan.moe/v4/top/anime').then(res => res.json())
            ]);

            // Populate sections with data
            if (newData.data) populateHorizontal(newAnimeList, newData.data);
            if (popularData.data) populateHorizontal(favoritesList, popularData.data);
            if (topData.data) populateHorizontal(highRatedList, topData.data);

        } catch (err) {
            console.error("Error loading sections:", err);
            const errorHTML = '<p style="color: red;">Error loading data</p>';
            newAnimeList.innerHTML = errorHTML;
            favoritesList.innerHTML = errorHTML;
            highRatedList.innerHTML = errorHTML;
        }
    }

    // -------------------- Helper Functions --------------------
    function populateHorizontal(container, animeList) {
        container.innerHTML = ''; // Clear loading message
        
        if (!animeList || animeList.length === 0) {
            container.innerHTML = '<p>No anime found</p>';
            return;
        }

        // Limit to first 20 items for performance
        animeList.slice(0, 20).forEach(anime => {
            const card = document.createElement('div');
            card.className = 'anime-card';
            card.innerHTML = `
                <img src="${anime.images?.jpg?.image_url || ''}" 
                    alt="${anime.title}"
                    onerror="this.src='https://via.placeholder.com/120x140?text=No+Image'">
                <strong>${anime.title}</strong>
                <div class="anime-info-line">
                    ${anime.score ? `⭐ ${anime.score}` : '⭐ N/A'} | 
                    ${getStatusIcon(anime.status)}
                    ${anime.episodes && anime.episodes !== 'Unknown' ? ` | 📺 ${anime.episodes} eps` : ''}
                </div
            `;

            card.addEventListener('click', () => {
                // Save COMPLETE anime data for both watchlist AND details
                localStorage.setItem('selectedAnime', JSON.stringify(anime));
                window.electronAPI.navigateTo('details.html');
            });

            container.appendChild(card);
        });
    }

    // Helper function for status icons
    function getStatusIcon(status) {
        const statusMap = {
            'Currently Airing': '🟢 Airing',
            'Finished Airing': '✅ Complete', 
            'Not yet aired': '🔜 Upcoming',
            'Upcoming': '🔜 Upcoming'
        };
        return statusMap[status] || '❓ Unknown';
    }

    // Make horizontal lists scrollable with mouse wheel
    document.querySelectorAll('.horizontal-list').forEach(list => {
        list.addEventListener('wheel', (evt) => {
            evt.preventDefault();
            list.scrollLeft += evt.deltaY;
        });
    });

    // -------------------- Initialize --------------------
    loadSections();
});