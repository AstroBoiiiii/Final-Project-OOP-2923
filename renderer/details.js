document.addEventListener('DOMContentLoaded', () => {
    const homeBtn = document.getElementById('homeBtn');
    const addBtn = document.getElementById('addWatchlistBtn');
    // -------------------- Add current page to navigation history --------------------
    window.electronAPI.addToHistory('details.html');
    
    // -------------------- Back Button --------------------
    const backBtn = document.getElementById('backBtn');
    backBtn.addEventListener('click', () => {
        window.electronAPI.goBack();
    });

    // -------------------- Navigation --------------------
    homeBtn.addEventListener('click', () => {
        window.electronAPI.goHome();
    });

    // -------------------- Load Anime Data --------------------
    const anime = JSON.parse(localStorage.getItem('selectedAnime') || '{}');

    if (!anime || !anime.title) {
        document.getElementById('detailsContainer').innerHTML = 
            '<p style="text-align: center; color: #666;">No anime data found. Please go back and select an anime.</p>';
        return;
    }

    // -------------------- Populate Additional Details --------------------
    function populateAdditionalDetails(anime) {
        // Rank
        if (anime.rank) {
            document.getElementById('animeRank').textContent = `#${anime.rank}`;
            document.getElementById('rankItem').style.display = 'block';
        }
        
        // Popularity
        if (anime.popularity) {
            document.getElementById('animePopularity').textContent = `#${anime.popularity}`;
            document.getElementById('popularityItem').style.display = 'block';
        }
        
        // Rating
        if (anime.rating) {
            document.getElementById('animeRating').textContent = anime.rating;
            document.getElementById('ratingItem').style.display = 'block';
        }
        
        // Genres
        if (anime.genres && anime.genres.length > 0) {
            document.getElementById('animeGenres').textContent = anime.genres.map(g => g.name).join(', ');
            document.getElementById('genresRow').style.display = 'flex';
        }
        
        // Producers
        if (anime.producers && anime.producers.length > 0) {
            document.getElementById('animeProducers').textContent = anime.producers.map(p => p.name).join(', ');
            document.getElementById('producersRow').style.display = 'flex';
        }
        
        // Source
        if (anime.source) {
            document.getElementById('animeSource').textContent = anime.source;
            document.getElementById('sourceItem').style.display = 'block';
        }
        
        // Status
        if (anime.status) {
            document.getElementById('animeStatus').textContent = anime.status;
            document.getElementById('statusItem').style.display = 'block';
        }
        
        // Aired
        if (anime.aired?.string) {
            document.getElementById('animeAired').textContent = anime.aired.string;
            document.getElementById('airedItem').style.display = 'block';
        }
        
        // MAL Link - Fix for manga
        if (anime.mal_id) {
            // Check if it's manga or anime
            const isManga = anime.type === 'manga' || anime.episodes === undefined;
            const malUrl = isManga ? 
                `https://myanimelist.net/manga/${anime.mal_id}` : 
                `https://myanimelist.net/anime/${anime.mal_id}`;
            
            document.getElementById('malLinkAnchor').href = malUrl;
            document.getElementById('malLink').style.display = 'block';
        }
        
        // Hide empty rows
        hideEmptyRows();
    }

    function hideEmptyRows() {
        // Hide rank/popularity row if all items are hidden
        const rankRow = document.getElementById('rankPopularityRow');
        const rankItems = rankRow.querySelectorAll('.detail-item');
        const visibleItems = Array.from(rankItems).filter(item => item.style.display !== 'none');
        if (visibleItems.length === 0) {
            rankRow.style.display = 'none';
        }
        
        // Hide source/status row if all items are hidden
        const sourceRow = document.getElementById('sourceStatusRow');
        const sourceItems = sourceRow.querySelectorAll('.detail-item');
        const visibleSourceItems = Array.from(sourceItems).filter(item => item.style.display !== 'none');
        if (visibleSourceItems.length === 0) {
            sourceRow.style.display = 'none';
        }
    }

    // Display anime details
    document.getElementById('animeTitle').innerText = anime.title;
    document.getElementById('animeImage').src = anime.images?.jpg?.image_url || anime.image || '';
    document.getElementById('animeSynopsis').innerText = anime.synopsis || 'No synopsis available.';
    document.getElementById('animeEpisodes').innerText = anime.episodes || 'Unknown';
    document.getElementById('animeScore').innerText = anime.score || 'N/A';
    populateAdditionalDetails(anime);

    // Save complete anime data for the template
    localStorage.setItem('selectedAnime', JSON.stringify(anime));

    // Handle image loading errors
    document.getElementById('animeImage').onerror = function() {
        this.src = 'https://via.placeholder.com/300x400?text=No+Image';
    };

    // -------------------- Review System --------------------
    let currentRating = 0;
    let editingReviewId = null;
    let reviews = []; // Initialize as empty array

    // Initialize review system
    initializeReviewSystem();

    // -------------------- Add to Watchlist --------------------
    addBtn.addEventListener('click', async () => {
        try {
            // Detect if it's manga or anime
            const isManga = anime.type === 'manga' || anime.episodes === undefined;
            
            // Get total episodes and create seasons/episodes structure
            const totalEpisodes = anime.episodes || 'Unknown';
            const seasons = detectSeasonsFromEpisodes(totalEpisodes);
            const seasonEpisodes = createSeasonEpisodes(seasons, totalEpisodes);

            const watchlistItem = {
                // Essential fields that match main.js validation
                title: anime.title,
                image: anime.images?.jpg?.image_url || anime.image || '',
                episodes: anime.episodes || 'Unknown',
                totalEpisodes: anime.episodes || 'Unknown', // Add this
                score: anime.score || 'N/A',
                synopsis: anime.synopsis || 'No synopsis available.',
                type: isManga ? 'manga' : 'anime',
                mal_id: anime.mal_id,
                
                // Add season/episode tracking data
                seasons: seasons,
                seasonEpisodes: seasonEpisodes,
                currentSeason: seasons[0],
                watchedEpisodes: 0,
                isCompleted: false,
                
                // Optional fields
                rank: anime.rank,
                popularity: anime.popularity,
                rating: anime.rating,
                genres: anime.genres,
                producers: anime.producers,
                source: anime.source,
                status: anime.status,
                aired: anime.aired
            };

            console.log('Adding to watchlist:', watchlistItem);

            const result = await window.electronAPI.saveWatchlistItem(watchlistItem);
            
            if (result.success) {
                alert('✅ Added to Watchlist!');
            } else {
                alert('⚠️ ' + result.message);
            }
        } catch (error) {
            console.error('Error adding to watchlist:', error);
            alert('❌ Error adding to watchlist. Please try again.');
        }
    });
    
    // -------------------- Review System Functions --------------------
    async function initializeReviewSystem() {
        setupStarRating();
        await loadReviews(); // Wait for reviews to load from file
        setupEventListeners();
    }

    function setupStarRating() {
        const stars = document.querySelectorAll('.star');
        stars.forEach((star, index) => {
            star.addEventListener('click', () => {
                currentRating = index + 1;
                updateStarDisplay();
            });
        });
    }

    function updateStarDisplay() {
        const stars = document.querySelectorAll('.star');
        stars.forEach((star, index) => {
            if (index < currentRating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    }

    function setupEventListeners() {
        const submitBtn = document.getElementById('submitReview');
        const cancelBtn = document.getElementById('cancelReview');

        submitBtn.addEventListener('click', handleReviewSubmit);
        cancelBtn.addEventListener('click', cancelEdit);
    }

    async function handleReviewSubmit() {
        const reviewText = document.getElementById('reviewText').value.trim();
        
        if (currentRating === 0) {
            alert('Please select a rating');
            return;
        }

        if (!reviewText) {
            alert('Please write a review');
            return;
        }

        const review = {
            id: editingReviewId || Date.now().toString(),
            rating: currentRating,
            text: reviewText,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (editingReviewId) {
            // Update existing review
            const index = reviews.findIndex(r => r.id === editingReviewId);
            if (index !== -1) {
                review.createdAt = reviews[index].createdAt; // Keep original creation date
                reviews[index] = review;
            }
        } else {
            // Add new review
            reviews.push(review);
        }

        await saveReviews(); // Wait for save to complete
        resetReviewForm();
        await loadReviews(); // Wait for reload to complete
        
        alert(editingReviewId ? 'Review updated!' : 'Review submitted!');
    }

    function cancelEdit() {
        resetReviewForm();
    }

    function resetReviewForm() {
        document.getElementById('reviewText').value = '';
        currentRating = 0;
        editingReviewId = null;
        updateStarDisplay();
        
        // Update button text
        document.getElementById('submitReview').textContent = 'Submit Review';
        document.getElementById('cancelReview').style.display = 'none';
    }

    async function loadReviews() {
        try {
            console.log('Loading reviews for MAL ID:', anime.mal_id);
            // Try to load from Electron API first
            const result = await window.electronAPI.loadReviews(anime.mal_id);
            console.log('Load reviews result:', result);
            
            if (result.success) {
                // Replace the current reviews array with the ones from file
                reviews = result.reviews || [];
                console.log('Loaded reviews from file:', reviews);
            } else {
                // Fallback to localStorage
                const localReviews = JSON.parse(localStorage.getItem(`reviews_${anime.mal_id}`) || '[]');
                reviews = localReviews;
                console.log('Loaded reviews from localStorage:', reviews);
            }
        } catch (error) {
            console.error('Error loading reviews from file:', error);
            // Fallback to localStorage
            const localReviews = JSON.parse(localStorage.getItem(`reviews_${anime.mal_id}`) || '[]');
            reviews = localReviews;
        }

        displayReviews();
    }

    function displayReviews() {
        const reviewsList = document.getElementById('reviewsList');
        
        if (reviews.length === 0) {
            reviewsList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No reviews yet. Be the first to review!</p>';
            return;
        }

        // Sort reviews by creation date (newest first)
        const sortedReviews = [...reviews].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        reviewsList.innerHTML = sortedReviews.map(review => `
            <div class="review-item" data-review-id="${review.id}">
                <div class="review-header">
                    <div class="review-rating">
                        ${generateStars(review.rating)}
                        <span class="review-date">
                            ${formatDate(review.createdAt)}
                            ${review.createdAt !== review.updatedAt ? 
                                `<span class="updated-badge">(Updated ${formatDate(review.updatedAt)})</span>` : ''
                            }
                        </span>
                    </div>
                    <div class="review-actions">
                        <button class="edit-review-btn" onclick="editReview('${review.id}')">✏️</button>
                        <button class="delete-review-btn" onclick="deleteReview('${review.id}')">🗑️</button>
                    </div>
                </div>
                <div class="review-content">
                    ${review.text}
                </div>
            </div>
        `).join('');
    }

    function generateStars(rating) {
        return '★'.repeat(rating) + '☆'.repeat(5 - rating);
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function editReview(reviewId) {
        const review = reviews.find(r => r.id === reviewId);
        if (!review) return;

        document.getElementById('reviewText').value = review.text;
        currentRating = review.rating;
        editingReviewId = reviewId;
        
        updateStarDisplay();
        
        // Update UI for editing mode
        document.getElementById('submitReview').textContent = 'Update Review';
        document.getElementById('cancelReview').style.display = 'inline-block';
        
        // Scroll to review form
        document.getElementById('reviewText').focus();
    }

    async function deleteReview(reviewId) {
        if (confirm('Are you sure you want to delete this review?')) {
            const index = reviews.findIndex(r => r.id === reviewId);
            if (index !== -1) {
                reviews.splice(index, 1);
                await saveReviews(); // Wait for save to complete
                await loadReviews(); // Wait for reload to complete
                alert('Review deleted!');
            }
        }
    }

    async function saveReviews() {
        try {
            console.log('Saving reviews:', reviews);
            // Use the Electron API to save reviews to reviews.json
            const result = await window.electronAPI.saveReview(anime.mal_id, reviews);
            console.log('Save result:', result);
            
            if (!result.success) {
                console.error('Failed to save reviews:', result.error);
                // Fallback to localStorage
                localStorage.setItem(`reviews_${anime.mal_id}`, JSON.stringify(reviews));
            } else {
                console.log('Reviews saved successfully to file');
            }
        } catch (error) {
            console.error('Error saving reviews:', error);
            // Fallback to localStorage if Electron API fails
            localStorage.setItem(`reviews_${anime.mal_id}`, JSON.stringify(reviews));
        }
    }

    // Make functions globally available for inline onclick handlers
    window.editReview = editReview;
    window.deleteReview = deleteReview;

    // -------------------- Season Detection (same as watchlist.js) --------------------
    function detectSeasonsFromEpisodes(totalEpisodes) {
        if (totalEpisodes === 'Unknown' || isNaN(parseInt(totalEpisodes))) {
            return ['Season 1'];
        }
        
        const episodeCount = parseInt(totalEpisodes);
        
        // Smart season breakdown based on common anime patterns
        if (episodeCount <= 13) {
            return ['Season 1'];
        } else if (episodeCount <= 26) {
            return ['Season 1', 'Season 2'];
        } else if (episodeCount <= 52) {
            return ['Season 1', 'Season 2', 'Season 3', 'Season 4'];
        } else {
            // For long-running series, create seasons with ~12-13 episodes each
            const seasonCount = Math.ceil(episodeCount / 13);
            return Array.from({length: seasonCount}, (_, i) => `Season ${i + 1}`);
        }
    }

    function createSeasonEpisodes(seasons, totalEpisodes) {
        if (totalEpisodes === 'Unknown' || isNaN(parseInt(totalEpisodes))) {
            return { 'Season 1': createEpisodesArray(12) };
        }
        
        const episodeCount = parseInt(totalEpisodes);
        const seasonEpisodes = {};
        
        if (seasons.length === 1) {
            // Single season - all episodes
            seasonEpisodes[seasons[0]] = createEpisodesArray(episodeCount);
        } else {
            // Multiple seasons - distribute episodes evenly
            const episodesPerSeason = Math.ceil(episodeCount / seasons.length);
            
            seasons.forEach((season, index) => {
                const startEpisode = (index * episodesPerSeason) + 1;
                const endEpisode = Math.min((index + 1) * episodesPerSeason, episodeCount);
                const seasonEpisodeCount = endEpisode - startEpisode + 1;
                
                seasonEpisodes[season] = createEpisodesArray(seasonEpisodeCount, startEpisode);
            });
        }
        
        return seasonEpisodes;
    }

    // Helper function to create episodes array
    function createEpisodesArray(count, startFrom = 1) {
        return Array.from({length: count}, (_, i) => ({
            number: startFrom + i,
            watched: false
        }));
    }
});