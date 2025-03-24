// Global variables
let userLocation = {
    city: 'London',
    country: 'United Kingdom',
    latitude: 51.5074,
    longitude: -0.1278
};

let locationTimeInterval = null; // For tracking the location-based time interval
let locationTime = null; // Store the fetched location time

// Prayer details - sunnah and fard rakah information
const prayerDetails = {
    fajr: { sunnah: '2 before', fard: 2 },
    dhuhr: { sunnah: '4 before, 2 after', fard: 4 },
    asr: { sunnah: '4 before', fard: 4 },
    maghrib: { sunnah: '2 after', fard: 3 },
    isha: { sunnah: '2 after', fard: 4 }
};

// Current settings
let settings = {
    calculationMethod: 3, // Default: Muslim World League (changed from 2/ISNA)
    juristicSchool: 0,    // Default: Standard
    latitudeMethod: 2,    // Default: Angle-Based (changed from 0/Middle of Night)
    midnightMode: 0,      // Default: Standard
    tune: {
        imsak: 0,
        fajr: 0,
        sunrise: 0,
        dhuhr: 0,
        asr: 0,
        sunset: 0,
        maghrib: 0,
        isha: 0,
        midnight: 0
    }
};

// Add this global variable to store temporary location
let tempLocation = null;

// Format time from 24h to 12h format
function formatTime(timeString) {
    // Parse the time (assuming format is "HH:MM")
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    
    // Convert to 12-hour format
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12; // Convert 0 to 12 for 12 AM
    
    return `${hour12}:${minutes} ${period}`;
}

// Update the clock display with device time (only used as fallback)
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    const dateString = now.toLocaleDateString(undefined, { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    document.getElementById('current-time').textContent = timeString;
    document.getElementById('current-date').textContent = dateString;
    
    // Check if we need to highlight the next prayer
    highlightNextPrayer();
    
    // Also check if we need to update prayer windows
    const prayerData = document.getElementById('prayer-times-grid').dataset.prayerData;
    if (prayerData) {
        const data = JSON.parse(prayerData);
        displayPrayerTimes(data);
    }
}

// Highlight the next prayer
function highlightNextPrayer() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    
    const prayerElements = document.querySelectorAll('.prayer-time');
    let nextPrayerFound = false;
    
    // Remove previous highlight
    prayerElements.forEach(element => {
        element.classList.remove('next-prayer');
        element.classList.remove('border-gold');
    });
    
    // Find the next prayer
    for (const element of prayerElements) {
        const prayerTime = element.dataset.time;
        if (prayerTime > currentTime) {
            element.classList.add('next-prayer');
            element.classList.add('border-gold');
            nextPrayerFound = true;
            break;
        }
    }
    
    // If no next prayer found (all prayers for today have passed), highlight the first prayer (Fajr) for tomorrow
    if (!nextPrayerFound && prayerElements.length > 0) {
        prayerElements[0].classList.add('next-prayer');
        prayerElements[0].classList.add('border-gold');
    }
}

// Update location display
function updateLocationDisplay() {
    const locationText = `${userLocation.city}, ${userLocation.country}`;
    document.getElementById('current-location').textContent = `Location: ${locationText}`;
}

// Show error message
function showError(message) {
    // Create error element if it doesn't exist
    let errorElement = document.getElementById('error-message');
    
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = 'error-message';
        errorElement.className = 'fixed top-4 right-4 bg-red-500 text-white p-4 rounded-md shadow-lg z-50 transition-opacity';
        document.body.appendChild(errorElement);
    }
    
    // Set message and show
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    errorElement.style.opacity = '1';
    
    // Hide after 5 seconds
    setTimeout(() => {
        errorElement.style.opacity = '0';
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 300);
    }, 5000);
}

// Utility function to debounce input
function debounce(func, delay) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

// Display prayer window instead of all prayer times
function displayPrayerTimes(data, customCurrentTime = null) {
    const prayerTimesGrid = document.getElementById('prayer-times-grid');
    
    // Validate data
    if (!data || !data.timings) {
        console.error('Invalid prayer data received:', data);
        prayerTimesGrid.innerHTML = `
            <div class="h-full flex items-center justify-center text-center">
                <div class="text-red-400">
                    <p class="mb-2">Unable to load prayer times</p>
                    <button onclick="fetchPrayerTimes()" class="px-4 py-2 bg-gray-700 rounded text-sm">
                        Try Again
                    </button>
                </div>
            </div>
        `;
        return;
    }
    
    const timings = data.timings;
    
    // Clear previous content
    prayerTimesGrid.innerHTML = '';
    prayerTimesGrid.className = 'h-full flex flex-col';
    
    // Get current time - use location time if available, otherwise use device time
    let currentTimeStr;
    if (customCurrentTime) {
        currentTimeStr = customCurrentTime;
    } else if (locationTime) {
        const currentHour = locationTime.getHours();
        const currentMinute = locationTime.getMinutes();
        currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    } else {
        const now = new Date();
        currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }
    
    // Store the data for future updates
    prayerTimesGrid.dataset.timings = JSON.stringify(timings);
    
    try {
        // Determine current salah window or next salah
        const currentPrayer = determineCurrentPrayer(timings, currentTimeStr);
        console.log("Determined salah state with time", currentTimeStr, ":", currentPrayer);
        
        // Create the salah window display
        const windowDisplay = document.createElement('div');
        windowDisplay.className = 'h-full flex flex-col justify-between p-4 rounded-lg';
        
        if (currentPrayer.active) {
            // We're in a salah window
            const prayer = currentPrayer.name;
            const startTime = timings[prayer];
            const endTime = timings[currentPrayer.endKey];
            const progress = calculateProgress(currentTimeStr, startTime, endTime);
            
            windowDisplay.classList.add('bg-gold/20', 'border', 'border-gold');
            
            windowDisplay.innerHTML = `
                <div class="text-center">
                    <h3 class="text-gold text-lg font-medium mb-1">Time To Pray</h3>
                    <div class="text-3xl font-bold mb-2">${prayer}</div>
                    <div class="text-gray-300">
                        ${formatTime(startTime)} - ${formatTime(endTime)}
                    </div>
                    <div class="mt-4 flex justify-between text-sm text-gray-400">
                        <span>${formatTime(startTime)}</span>
                        <span>${prayerDetails[prayer.toLowerCase()]?.fard || '-'} Fard</span>
                        <span>${formatTime(endTime)}</span>
                    </div>
                </div>
                
                <div class="my-4">
                    <div class="w-full bg-gray-700 rounded-full h-3 mb-2">
                        <div class="bg-gold h-3 rounded-full" style="width: ${progress}%"></div>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-400">Started ${formatTimeAgo(currentTimeStr, startTime)}</span>
                        <span class="text-gold font-medium">${formatTimeRemaining(currentTimeStr, endTime)}</span>
                    </div>
                </div>
            `;
        } else {
            // We're between salah windows, show next salah
            const nextPrayer = currentPrayer.next || 'Fajr';
            const nextTime = currentPrayer.nextTime || timings[nextPrayer];
            const periodStartTime = currentPrayer.periodStart || timings.Fajr;
            
            // Updated to match current salah window styling
            windowDisplay.classList.add('bg-gold/20', 'border', 'border-gold');
            
            // Calculate progress
            const progressPercent = calculateProgress(currentTimeStr, periodStartTime, nextTime);
            
            // Check if this is the Tahajjud period
            if (currentPrayer.special === "tahajjud") {
                windowDisplay.innerHTML = `
                    <div class="text-center">
                        <h3 class="text-gold text-lg font-medium mb-1">Last Third of Night</h3>
                        <div class="text-3xl font-bold mb-2">Tahajjud Time</div>
                        <div class="text-gray-300">
                            Best time for Tahajjud Prayer
                        </div>
                        <div class="text-xs text-gray-400 mt-2">
                            Next: Fajr at ${formatTime(nextTime)}
                        </div>
                    </div>
                    
                    <div class="my-4">
                        <div class="w-full bg-gray-700 rounded-full h-3 mb-2">
                            <div class="bg-gold h-3 rounded-full" style="width: ${progressPercent}%"></div>
                        </div>
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-400">Time until Fajr</span>
                            <span class="text-gold font-medium">${formatTimeRemaining(currentTimeStr, nextTime)}</span>
                        </div>
                    </div>
                `;
            } else {
                // Regular "Next Salah" display (for after Isha, Early Night, etc.)
                windowDisplay.innerHTML = `
                    <div class="text-center">
                        <h3 class="text-gold text-lg font-medium mb-1">Next Salah</h3>
                        <div class="text-3xl font-bold mb-2">${nextPrayer}</div>
                        <div class="text-gray-300">
                            at ${formatTime(nextTime)}
                        </div>
                        <div class="text-xs text-gray-400 mt-2">
                            ${prayerDetails[nextPrayer.toLowerCase()]?.fard || '-'} Fard
                        </div>
                    </div>
                    
                    <div class="my-4">
                        <div class="w-full bg-gray-700 rounded-full h-3 mb-2">
                            <div class="bg-gold h-3 rounded-full" style="width: ${progressPercent}%"></div>
                        </div>
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-400">Time remaining</span>
                            <span class="text-gold font-medium">${formatTimeRemaining(currentTimeStr, nextTime)}</span>
                        </div>
                    </div>
                `;
            }
        }
        
        prayerTimesGrid.appendChild(windowDisplay);
    } catch (error) {
        console.error('Error displaying prayer window:', error);
        prayerTimesGrid.innerHTML = `
            <div class="h-full flex items-center justify-center text-center">
                <div class="text-red-400">
                    <p class="mb-2">Error displaying prayer times</p>
                    <p class="text-xs mb-3">${error.message}</p>
                    <button onclick="fetchPrayerTimes()" class="px-4 py-2 bg-gray-700 rounded text-sm">
                        Try Again
                    </button>
                </div>
            </div>
        `;
    }
    
    // Only set up the update timer if we're not using a custom time
    if (!customCurrentTime) {
        // Update every minute to keep the window status current
        setTimeout(() => {
            updatePrayerWindowDisplay();
        }, 60000);
    }
}

// Update determineCurrentPrayer to include Tahajjud period
function determineCurrentPrayer(timings, currentTimeStr) {
    console.log("Prayer timings:", timings);
    console.log("Current time:", currentTimeStr);
    
    // Calculate Tahajjud time
    const tahajjudTime = calculateTahajjudTime(timings);
    
    // Define prayer windows and their boundaries
    const prayerWindows = [
        {
            name: "Fajr",
            start: timings.Fajr,
            end: timings.Sunrise,
            endName: "Sunrise",
            nextPrayer: "Dhuhr"
        },
        {
            name: "Dhuhr",
            start: timings.Dhuhr,
            end: timings.Asr,
            endName: "Asr",
            nextPrayer: "Asr"
        },
        {
            name: "Asr",
            start: timings.Asr,
            end: timings.Maghrib,
            endName: "Maghrib",
            nextPrayer: "Maghrib"
        },
        {
            name: "Maghrib",
            start: timings.Maghrib,
            end: timings.Isha,
            endName: "Isha",
            nextPrayer: "Isha"
        },
        {
            name: "Isha",
            start: timings.Isha,
            end: timings.Midnight,
            endName: "Midnight",
            nextPrayer: "Tahajjud" // Changed from Fajr to Tahajjud
        }
    ];
    
    // Define periods between prayers
    const betweenPeriods = [
        {
            name: "Early Night",
            start: timings.Midnight,
            end: tahajjudTime,
            nextPrayer: "Fajr",           // CHANGED FROM "Tahajjud" to "Fajr"
            nextTime: timings.Fajr        // Use Fajr time directly
        },
        {
            name: "Tahajjud",
            start: tahajjudTime,
            end: timings.Fajr,
            nextPrayer: "Fajr",
            nextTime: timings.Fajr,  // Add this property
            special: "tahajjud"
        },
        {
            name: "After Fajr",
            start: timings.Sunrise,
            end: timings.Dhuhr,
            nextPrayer: "Dhuhr"
        },
        {
            name: "After Dhuhr",
            start: timings.Dhuhr,
            end: timings.Asr,
            nextPrayer: "Asr"
        },
        {
            name: "After Asr",
            start: timings.Asr,
            end: timings.Maghrib,
            nextPrayer: "Maghrib"
        },
        {
            name: "After Maghrib",
            start: timings.Maghrib,
            end: timings.Isha,
            nextPrayer: "Isha"
        },
        {
            name: "After Isha",
            start: timings.Isha,
            end: timings.Midnight,
            nextPrayer: "Fajr",           // CHANGED FROM "Tahajjud" to "Fajr"
            nextTime: timings.Fajr        // Use Fajr time directly
        }
    ];
    
    // Check if we're in a prayer window
    for (const window of prayerWindows) {
        console.log(`Checking if ${currentTimeStr} is between ${window.start} and ${window.end} (${window.name})`);
        
        if (isTimeBetween(currentTimeStr, window.start, window.end)) {
            console.log(`Found: Currently in ${window.name} window`);
            return { 
                active: true, 
                name: window.name,
                endKey: window.endName,
                endTime: window.end,
                nextPrayer: window.nextPrayer
            };
        }
    }
    
    // If not in a prayer window, determine the between-prayer period
    for (const period of betweenPeriods) {
        console.log(`Checking if ${currentTimeStr} is between ${period.start} and ${period.end} (${period.name})`);
        
        if (isTimeBetween(currentTimeStr, period.start, period.end)) {
            console.log(`Found: Currently in ${period.name} period`);
            return {
                active: false,
                next: period.nextPrayer,
                nextTime: period.nextTime, // Add this line
                period: period.name,
                periodStart: period.start,
                special: period.special
            };
        }
    }
    
    // If all else fails (shouldn't happen), default to Night period with Fajr as next prayer
    console.warn("Could not determine current prayer or period - using default");
    return {
        active: false,
        next: "Fajr",
        period: "Night",
        periodStart: timings.Midnight
    };
}

// Calculate progress percentage for progress bar
function calculateProgress(currentTime, startTime, endTime) {
    // Convert times to minutes with day boundary handling
    let current = timeToMinutes(currentTime); // Changed from const to let
    let start = timeToMinutes(startTime);
    let end = timeToMinutes(endTime);
    
    // Handle day boundary cases
    if (end < start) {
        // Period crosses midnight
        end += 24 * 60; // Add a day
        if (current < start) {
            // Current time is after midnight
            current += 24 * 60;
        }
    }
    
    // Calculate progress percentage
    const total = end - start;
    if (total <= 0) {
        console.warn('Invalid time range for progress calculation', {
            start, end, total
        });
        return 0;
    }
    
    const elapsed = current - start;
    const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
    
    return Math.round(progress);
}

// Calculate progress percentage for waiting period
function calculateWaitingProgress(currentTime, periodStartTime, nextPrayerTime) {
    // Convert times to minutes since midnight
    const current = timeToMinutes(currentTime);
    let start = timeToMinutes(periodStartTime);
    let end = timeToMinutes(nextPrayerTime);
    
    // Handle day boundary cases
    if (end < start) {
        end += 24 * 60; // Add a day
        if (current < start) {
            // We're after midnight
            current += 24 * 60;
        }
    }
    
    // Calculate progress percentage
    const total = end - start;
    const elapsed = current - start;
    const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
    
    return Math.round(progress);
}

// Convert time string to minutes since midnight - with improved error handling
function timeToMinutes(timeStr) {
    // Handle undefined or invalid input
    if (!timeStr || typeof timeStr !== 'string') {
        console.warn(`Invalid time value: ${timeStr}`);
        return 0; // Return a default value
    }
    
    try {
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) {
            console.warn(`Invalid time format: ${timeStr}`);
            return 0;
        }
        return (hours * 60) + minutes;
    } catch (error) {
        console.error(`Error parsing time string "${timeStr}":`, error);
        return 0;
    }
}

// Improved time comparison helpers that handle day boundaries
function compareTimeWithBoundary(time1, time2) {
    if (!time1 || !time2) return 0;
    
    const minutes1 = timeToMinutes(time1);
    const minutes2 = timeToMinutes(time2);
    
    // Handle cases where one time is after midnight and one is before
    // Example: comparing 23:00 with 01:00
    if (Math.abs(minutes1 - minutes2) > 720) {
        // If time1 is in the evening and time2 is in the morning
        if (minutes1 > 720 && minutes2 < 720) {
            return -1; // time1 is considered "earlier" when crossing day boundary
        }
        // If time2 is in the evening and time1 is in the morning
        if (minutes2 > 720 && minutes1 < 720) {
            return 1; // time1 is considered "later" when crossing day boundary
        }
    }
    
    return minutes1 - minutes2;
}

// Improved time comparison helpers that handle day boundaries
function isTimeBefore(time1, time2) {
    return compareTimeWithBoundary(time1, time2) < 0;
}

function isTimeAfter(time1, time2) {
    return compareTimeWithBoundary(time1, time2) > 0;
}

function isTimeEqual(time1, time2) {
    return compareTimeWithBoundary(time1, time2) === 0;
}

function isTimeBetween(time, start, end) {
    // Handle the case where the period crosses midnight
    if (compareTimeWithBoundary(start, end) > 0) {
        // Period crosses midnight
        return compareTimeWithBoundary(time, start) >= 0 || compareTimeWithBoundary(time, end) < 0;
    } else {
        // Normal case (start is before end)
        return compareTimeWithBoundary(time, start) >= 0 && compareTimeWithBoundary(time, end) < 0;
    }
}

// Format time elapsed since a given time
function formatTimeAgo(currentTime, referenceTime) {
    if (!currentTime || !referenceTime) {
        return "unknown time";
    }
    
    const current = timeToMinutes(currentTime);
    let reference = timeToMinutes(referenceTime);
    
    // Handle day boundary cases
    if (reference > current && reference - current > 720) {
        // Reference time is likely yesterday (e.g., Isha at 22:00, now is 01:00)
        reference -= 24 * 60;
    } else if (current > reference && current - reference > 720) {
        // Current time is likely tomorrow (rare edge case)
        return "just now"; // Simplify the output for this rare case
    }
    
    // Calculate difference
    const diffMinutes = current - reference;
    if (diffMinutes < 0) {
        return "upcoming"; // Handle negative times (should not happen with proper boundary handling)
    }
    
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    // Format the output
    if (hours > 0) {
        return `${hours}h ${minutes}m ago`;
    } else {
        return `${minutes}m ago`;
    }
}

// Format time remaining until a given time - with improved handling
function formatTimeRemaining(currentTime, targetTime) {
    // Handle empty input
    if (!currentTime || !targetTime) {
        return "time unknown";
    }
    
    // Convert to minutes
    const current = timeToMinutes(currentTime);
    let target = timeToMinutes(targetTime);
    
    // Handle day boundary cases
    if (target <= current) {
        // Target is tomorrow
        target += 24 * 60;
    }
    
    // Calculate difference
    const diffMinutes = target - current;
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    // Format the output
    if (hours > 0) {
        return `${hours}h ${minutes}m remaining`;
    } else {
        return `${minutes}m remaining`;
    }
}

// Get the name of the current window between prayers
function getCurrentWindowName(periodName) {
    switch (periodName) {
        case 'Night': return 'Night';
        case 'Forenoon': return 'Forenoon (Duha)';
        case 'Fajr End': return 'After Fajr';
        case 'Dhuhr End': return 'After Dhuhr';
        case 'Asr End': return 'After Asr';
        case 'Maghrib End': return 'After Maghrib';
        case 'Isha End': return 'After Isha';
        default: return periodName;
    }
}

// Get the next prayer after the current one
function getNextPrayer(currentPrayer) {
    const prayerOrder = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const currentIndex = prayerOrder.indexOf(currentPrayer);
    
    if (currentIndex === -1) return 'Fajr';
    if (currentIndex === prayerOrder.length - 1) return 'Fajr';
    
    return prayerOrder[currentIndex + 1];
}

// Update the displayAdditionalTimes function to include Tahajjud
function displayAdditionalTimes(data) {
    const additionalTimesContainer = document.getElementById('additional-times');
    const timings = data.timings;
    
    // Clear previous content
    additionalTimesContainer.innerHTML = '';
    
    // Calculate Tahajjud time
    const tahajjudTime = calculateTahajjudTime(timings);
    
    // Additional times to display
    const additionalTimes = [
        { name: 'Tahajjud', key: 'Tahajjud', time: tahajjudTime, description: 'Last third of night' },
        { name: 'Imsak', key: 'Imsak' },
        { name: 'Sunrise', key: 'Sunrise' },
        { name: 'Sunset', key: 'Sunset' },
        { name: 'Midnight', key: 'Midnight' }
    ];
    
    additionalTimes.forEach(item => {
        // Use calculated time for Tahajjud, API time for others
        const time = item.time || timings[item.key];
        if (!time) return; // Skip if time is not available
        
        const formattedTime = formatTime(time);
        
        const listItem = document.createElement('li');
        listItem.className = 'flex justify-between items-center p-2 bg-gray-700/50 rounded';
        
        listItem.innerHTML = `
            <div>
                <span class="text-gray-300">${item.name}</span>
                ${item.description ? `<div class="text-xs text-gray-400">${item.description}</div>` : ''}
            </div>
            <span class="font-medium">${formattedTime}</span>
        `;
        
        // Add a small indicator if time was adjusted (except for Tahajjud)
        if (item.key !== 'Tahajjud') {
            const keyLower = item.key.toLowerCase();
            const tuneAmount = settings.tune[keyLower] || 0;
            if (tuneAmount !== 0) {
                const indicator = document.createElement('span');
                indicator.className = 'text-xs text-yellow-400 ml-2';
                indicator.textContent = tuneAmount > 0 ? `+${tuneAmount}m` : `${tuneAmount}m`;
                listItem.querySelector('span:last-child').appendChild(indicator);
            }
        }
        
        additionalTimesContainer.appendChild(listItem);
    });
}

// Display prayer details in the table
function displayPrayerDetails(data) {
    const prayerDetailsTable = document.getElementById('prayer-details');
    const timings = data.timings;
    
    // Clear previous content
    prayerDetailsTable.innerHTML = '';
    
    // Prayer details to display
    const prayers = [
        { name: 'Fajr', key: 'Fajr', details: prayerDetails.fajr },
        { name: 'Dhuhr', key: 'Dhuhr', details: prayerDetails.dhuhr },
        { name: 'Asr', key: 'Asr', details: prayerDetails.asr },
        { name: 'Maghrib', key: 'Maghrib', details: prayerDetails.maghrib },
        { name: 'Isha', key: 'Isha', details: prayerDetails.isha }
    ];
    
    prayers.forEach(prayer => {
        const time = timings[prayer.key]; // Use time directly from API - it already has adjustments
        const formattedTime = formatTime(time);
        
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-700';
        
        row.innerHTML = `
            <td class="py-2 pr-4">${prayer.name}</td>
            <td class="py-2 pr-4">${formattedTime}</td>
            <td class="py-2 pr-4">${prayer.details.sunnah || '-'}</td>
            <td class="py-2 pr-4">${prayer.details.fard}</td>
        `;
        
        prayerDetailsTable.appendChild(row);
    });
}

// Updated fetchPrayerTimes function to call all display functions
function fetchPrayerTimes() {
    // Construct tune parameter
    let tuneParam = '';
    if (settings.tune) {
        tuneParam = `&tune=${settings.tune.imsak},${settings.tune.fajr},${settings.tune.sunrise},` +
                    `${settings.tune.dhuhr},${settings.tune.asr},${settings.tune.sunset},` +
                    `${settings.tune.maghrib},${settings.tune.isha},${settings.tune.midnight}`;
    }
    
    const apiUrl = `https://api.aladhan.com/v1/timings?latitude=${userLocation.latitude}&longitude=${userLocation.longitude}&method=${settings.calculationMethod}&school=${settings.juristicSchool}&latitudeAdjustmentMethod=${settings.latitudeMethod}&midnightMode=${settings.midnightMode}${tuneParam}`;
    
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            if (data.code === 200) {
                // Store the data for reference
                if (!window.prayerTimesData) {
                    window.prayerTimesData = {};
                }
                window.prayerTimesData.timings = data.data.timings;
                
                // Display components
                // If we have location time, use it for prayer window
                if (locationTime) {
                    const currentHour = locationTime.getHours();
                    const currentMinute = locationTime.getMinutes();
                    const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
                    displayPrayerTimes(data.data, currentTimeStr);
                } else {
                    displayPrayerTimes(data.data);
                }
                
                displayAdditionalTimes(data.data);
                displayPrayerDetails(data.data);
            } else {
                console.error('API Error:', data);
                showError('Failed to fetch prayer times. Please try again.');
            }
        })
        .catch(error => {
            console.error('Fetch Error:', error);
            showError('Network error. Please check your connection and try again.');
        });
}

// Save settings to localStorage
function saveSettings() {
    // Save prayer calculation settings
    settings = {
        calculationMethod: document.getElementById('calculationMethod').value,
        juristicSchool: document.getElementById('juristicSchool').value,
        latitudeMethod: document.getElementById('latitudeMethod').value,
        midnightMode: document.getElementById('midnightMode').value,
        tune: {
            imsak: parseInt(document.getElementById('tuneImsak').value) || 0,
            fajr: parseInt(document.getElementById('tuneFajr').value) || 0,
            sunrise: parseInt(document.getElementById('tuneSunrise').value) || 0,
            dhuhr: parseInt(document.getElementById('tuneDhuhr').value) || 0,
            asr: parseInt(document.getElementById('tuneAsr').value) || 0,
            sunset: parseInt(document.getElementById('tuneSunset').value) || 0,
            maghrib: parseInt(document.getElementById('tuneMaghrib').value) || 0,
            isha: parseInt(document.getElementById('tuneIsha').value) || 0,
            midnight: parseInt(document.getElementById('tuneMidnight').value) || 0
        }
    };
    
    localStorage.setItem('prayerSettings', JSON.stringify(settings));
    
    // Apply location change if we have a pending location change
    if (tempLocation) {
        userLocation = tempLocation;
        localStorage.setItem('userLocation', JSON.stringify(userLocation));
        tempLocation = null;
        
        // Update location display
        updateLocationDisplay();
        
        // Clear existing timer first
        if (locationTimeInterval) {
            clearInterval(locationTimeInterval);
            locationTimeInterval = null;
        }
        
        // Fetch new location time
        fetchCurrentTime();
        
        // Then fetch prayer times
        fetchPrayerTimes();
        
        // Remove the note
        const noteElement = document.getElementById('location-note');
        if (noteElement) {
            noteElement.remove();
        }
    } else {
        // If only prayer settings changed, still update prayer times
        fetchPrayerTimes();
    }
    
    // Reset the apply button to gold
    const applyButton = document.getElementById('applySettings');
    applyButton.classList.remove('animate-pulse');
    applyButton.classList.remove('bg-yellow-500');
    applyButton.classList.add('bg-gold');
    applyButton.textContent = 'Apply Settings';
    
    // Show success message
    showSettingsUpdated();
}

// Handle location search
function handleLocationSearch() {
    const searchTerm = document.getElementById('locationSearch').value.trim();
    const suggestionsContainer = document.getElementById('locationSuggestions');
    
    if (searchTerm.length < 2) {
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.classList.add('hidden');
        return;
    }
    
    // Use OpenStreetMap Nominatim API for geocoding
    const apiUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&limit=5`;
    
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            suggestionsContainer.innerHTML = '';
            
            if (data.length === 0) {
                suggestionsContainer.innerHTML = '<div class="p-2 text-sm text-gray-400">No results found</div>';
                suggestionsContainer.classList.remove('hidden');
                return;
            }
            
            data.forEach(place => {
                const suggestion = document.createElement('div');
                suggestion.className = 'p-2 hover:bg-gray-600 cursor-pointer';
                suggestion.textContent = place.display_name;
                
                suggestion.addEventListener('click', () => {
                    document.getElementById('locationSearch').value = place.display_name;
                    suggestionsContainer.classList.add('hidden');
                    
                    // Store location temporarily instead of applying immediately
                    tempLocation = {
                        city: place.display_name.split(',')[0],
                        country: place.display_name.split(',').pop().trim(),
                        latitude: parseFloat(place.lat),
                        longitude: parseFloat(place.lon)
                    };
                    
                    // Show a notification that changes need to be applied
                    showChangesPendingNotification();
                });
                
                suggestionsContainer.appendChild(suggestion);
            });
            
            suggestionsContainer.classList.remove('hidden');
        })
        .catch(error => {
            console.error('Geocoding Error:', error);
            suggestionsContainer.innerHTML = '<div class="p-2 text-sm text-gray-400">An error occurred. Please try again.</div>';
            suggestionsContainer.classList.remove('hidden');
        });
}

// Get current location using geolocation API
function getCurrentLocation() {
    if (navigator.geolocation) {
        document.getElementById('getCurrentLocation').textContent = 'Detecting...';
        
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                // Change this line to use getLocationNameOnly instead of reverseGeocode
                getLocationNameOnly(lat, lon);
            },
            function(error) {
                console.error('Geolocation Error:', error);
                document.getElementById('getCurrentLocation').textContent = 'Use My Location';
                showError('Unable to retrieve your location. Please enter it manually.');
            }
        );
    } else {
        showError('Geolocation is not supported by your browser. Please enter your location manually.');
    }
}

// Get location name without applying changes - fixed to handle undefined city
function getLocationNameOnly(lat, lon) {
    const apiUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            document.getElementById('getCurrentLocation').textContent = 'Use My Location';
            
            // Extract city and country with improved fallbacks
            const address = data.address;
            
            // Try to get the most specific location name available
            const city = address.city || address.town || address.village || address.hamlet || 
                        address.suburb || address.county || address.state_district || 
                        address.state || data.name || "Location";
            
            const country = address.country || "";
            
            // Log address data for debugging
            console.log("Address data:", address);
            
            // Store location temporarily
            tempLocation = {
                city: city,
                country: country,
                latitude: lat,
                longitude: lon
            };
            
            // Update input field but don't apply changes yet
            document.getElementById('locationSearch').value = `${city}, ${country}`;
            
            // Show a notification that changes need to be applied
            showChangesPendingNotification();
        })
        .catch(error => {
            console.error('Reverse Geocoding Error:', error);
            document.getElementById('getCurrentLocation').textContent = 'Use My Location';
            
            // Use coordinates as fallback name
            tempLocation = {
                city: `Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
                country: '',
                latitude: lat,
                longitude: lon
            };
            
            document.getElementById('locationSearch').value = tempLocation.city;
            showChangesPendingNotification();
        });
}

// Show notification that changes need to be applied
function showChangesPendingNotification() {
    const applyButton = document.getElementById('applySettings');
    
    // Remove animation class and keep color gold
    applyButton.classList.remove('animate-pulse');
    applyButton.classList.remove('bg-yellow-500');
    
    // Make sure button stays gold colored
    applyButton.classList.add('bg-gold');
    
    applyButton.textContent = 'Apply Changes';
    
    // Add a note next to the location field if not already there
    let noteElement = document.getElementById('location-note');
    if (!noteElement) {
        const locationContainer = document.getElementById('locationSearch').parentNode;
        noteElement = document.createElement('div');
        noteElement.id = 'location-note';
        noteElement.className = 'text-xs text-gold mt-1';
        noteElement.textContent = '* Click "Apply Changes" to update your location';
        locationContainer.appendChild(noteElement);
    }
}

// Variables for improved time tracking
let lastTimestamp = 0;
let timeOffset = 0;

// Add a variable to control time update frequency
let lastSecondUpdated = -1;

// Fetch the current time from TimeAPI.io
function fetchCurrentTime() {
    // Clear any existing interval to prevent multiple updaters
    if (locationTimeInterval) {
        clearInterval(locationTimeInterval);
        locationTimeInterval = null;
    }
    
    // Show loading state
    document.getElementById('current-time').textContent = "Loading...";
    document.getElementById('current-date').textContent = "Fetching time for location...";
    
    // Primary API - TimeAPI.io
    const timeApiUrl = `https://timeapi.io/api/Time/current/coordinate?latitude=${userLocation.latitude}&longitude=${userLocation.longitude}`;
    
    fetch(timeApiUrl)
        .then(response => response.json())
        .then(data => {
            if (data) {
                console.log("TimeAPI response:", data);
                
                try {
                    // Use the dateTime property directly if available (ISO format)
                    if (data.dateTime) {
                        locationTime = new Date(data.dateTime);
                    } 
                    // Fallback to building the date from components
                    else {
                        let month = 0; // Default to January
                        
                        if (data.month !== undefined) {
                            month = parseInt(data.month) - 1;
                        } else if (data.monthText) {
                            month = getMonthNumber(data.monthText);
                        }
                        
                        locationTime = new Date(
                            data.year || new Date().getFullYear(), 
                            month,
                            data.day || 1, 
                            data.hour || 0, 
                            data.minute || 0, 
                            data.seconds || 0
                        );
                    }
                    
                    // Save initial timestamp for drift correction
                    lastTimestamp = Date.now();
                    timeOffset = 0;
                    
                    // Update UI with this time
                    updateLocationBasedTime();
                    
                    if (locationTimeInterval) {
                        clearInterval(locationTimeInterval);
                    }
                    
                    startTimeUpdates();
                    setupVisibilityListeners();
                    updatePrayerWindowDisplay();
                } catch (error) {
                    console.error("Error parsing time data:", error);
                    fetchTimeFromBackupAPI();
                }
            } else {
                fetchTimeFromBackupAPI();
            }
        })
        .catch(error => {
            console.error('Time API Error:', error);
            fetchTimeFromBackupAPI();
        });
}

// New function to handle backup time API request
function fetchTimeFromBackupAPI() {
    // Use WorldTimeAPI as a backup
    const backupApiUrl = `https://worldtimeapi.org/api/timezone/Etc/GMT${getInvertedGMTOffset()}`;
    
    fetch(backupApiUrl)
        .then(response => response.json())
        .then(data => {
            if (data && data.datetime) {
                console.log("Backup API response:", data);
                locationTime = new Date(data.datetime);
                
                // Save initial timestamp for drift correction
                lastTimestamp = Date.now();
                timeOffset = 0;
                
                updateLocationBasedTime();
                
                if (locationTimeInterval) {
                    clearInterval(locationTimeInterval);
                }
                
                startTimeUpdates();
                setupVisibilityListeners();
                updatePrayerWindowDisplay();
            } else {
                estimateLocationTime();
            }
        })
        .catch(error => {
            console.error('Backup Time API Error:', error);
            estimateLocationTime();
        });
}

// Estimate location time based on longitude when both APIs fail
function estimateLocationTime() {
    console.log("Estimating time based on longitude...");
    
    // Get the user's current local time
    const now = new Date();
    
    // Estimate timezone offset based on longitude
    // Approximate timezone by dividing longitude by 15 (15 degrees per timezone)
    const estimatedOffset = Math.round(userLocation.longitude / 15);
    
    // Get user's local offset in hours
    const localOffset = -now.getTimezoneOffset() / 60;
    
    // Calculate difference between local and estimated timezone
    const offsetDiff = estimatedOffset - localOffset;
    
    // Apply the offset difference to get the estimated time
    const estimatedTime = new Date(now.getTime() + (offsetDiff * 60 * 60 * 1000));
    
    console.log(`Estimated timezone offset: ${estimatedOffset}h, Local offset: ${localOffset}h, Diff: ${offsetDiff}h`);
    console.log(`Estimated time for ${userLocation.city}: ${estimatedTime.toISOString()}`);
    
    locationTime = estimatedTime;
    
    // Save initial timestamp for drift correction
    lastTimestamp = Date.now();
    timeOffset = 0;
    
    updateLocationBasedTime();
    
    if (locationTimeInterval) {
        clearInterval(locationTimeInterval);
        locationTimeInterval = null;
    }
    
    startTimeUpdates();
    setupVisibilityListeners();
    updatePrayerWindowDisplay();
}

// Helper function to get the inverted GMT offset for WorldTimeAPI
function getInvertedGMTOffset() {
    // Estimate timezone offset based on longitude (15 degrees per timezone)
    const estimatedOffset = Math.round(userLocation.longitude / 15);
    
    // WorldTimeAPI uses an inverted format where positive is negative and vice versa
    return estimatedOffset > 0 ? `-${estimatedOffset}` : `+${Math.abs(estimatedOffset)}`;
}

// Add this helper function to convert month names to numbers
function getMonthNumber(monthName) {
    const months = {
        'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
        'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
    };
    return months[monthName.toLowerCase()] || 0;
}

// Fallback to using local time with timezone adjustment
function fallbackToLocalTime() {
    // Create a message about using estimated time - without changing color or adding notes
    document.getElementById('current-time').textContent = new Date().toLocaleTimeString();
    document.getElementById('current-date').textContent = new Date().toLocaleDateString(undefined, { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    // Still use local incrementing but with better background handling
    locationTime = new Date();
    
    // Save initial timestamp for drift correction
    lastTimestamp = Date.now();
    timeOffset = 0;
    
    // Clear any existing interval
    if (locationTimeInterval) {
        clearInterval(locationTimeInterval);
        locationTimeInterval = null;
    }
    
    // Use the requestAnimationFrame approach
    startTimeUpdates();
    
    // Set up visibility change listeners for background/foreground transitions
    setupVisibilityListeners();
}

// New function to handle visibility changes (tab switching, app switching)
function setupVisibilityListeners() {
    // Remove any existing listeners first to avoid duplicates
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also handle page show/hide events which can be useful on some mobile browsers
    window.removeEventListener('pageshow', handlePageShow);
    window.addEventListener('pageshow', handlePageShow);
    
    // For desktop browsers, handle focus/blur
    window.removeEventListener('focus', handleFocus);
    window.addEventListener('focus', handleFocus);
}

// Handler for visibility change
function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
        console.log("App became visible - updating time");
        correctTimeOnResume();
    }
}

// Handler for page show event
function handlePageShow() {
    console.log("Page shown - updating time");
    correctTimeOnResume();
}

// Handler for window focus event
function handleFocus() {
    console.log("Window focused - updating time");
    correctTimeOnResume();
}

// Correct the time when resuming from background
function correctTimeOnResume() {
    if (!locationTime) return;
    
    // Calculate how many milliseconds have passed since we last updated the time
    const now = Date.now();
    const elapsed = now - lastTimestamp;
    lastTimestamp = now;
    
    if (elapsed > 1000) { // Only adjust if more than a second has passed
        // Add the elapsed time to our time object
        timeOffset += elapsed;
        
        // Update the displayed time immediately
        updateLocationBasedTime(true);
        
        // Also update prayer window
        updatePrayerWindowDisplay();
    }
}

// Start using a more stable time update approach
function startTimeUpdates() {
    // Clear any existing intervals
    if (locationTimeInterval) {
        clearInterval(locationTimeInterval);
        locationTimeInterval = null;
    }
    
    // Reset our tracking variables
    lastTimestamp = Date.now();
    timeOffset = 0;
    lastSecondUpdated = -1;
    
    // Use a simpler approach with just setInterval
    // This runs every 250ms to check if we need to update, but only updates once per second
    locationTimeInterval = setInterval(() => {
        const now = Date.now();
        
        // Calculate how many full seconds have passed
        const secondsElapsed = Math.floor((now - lastTimestamp) / 1000);
        
        if (secondsElapsed > 0) {
            // Update lastTimestamp to account for the seconds we're processing
            // We keep the precise milliseconds to avoid drift
            lastTimestamp += secondsElapsed * 1000;
            
            // If in background, just increment the internal time
            if (document.visibilityState === 'hidden') {
                if (locationTime) {
                    locationTime.setSeconds(locationTime.getSeconds() + secondsElapsed);
                }
            } else {
                // When visible, update the UI too
                timeOffset += secondsElapsed * 1000;
                updateLocationBasedTime(secondsElapsed > 1); // Force update if we missed multiple seconds
            }
        }
    }, 250);
    
    // Also listen for visibility changes to handle background-to-foreground transitions
    setupVisibilityListeners();
}

// Update the time based on the stored location time
function updateLocationBasedTime(forceUpdate = false) {
    if (!locationTime) return;
    
    // Make a backup of the old time for debugging
    const oldSeconds = locationTime.getSeconds();
    const oldMinutes = locationTime.getMinutes();
    
    if (timeOffset >= 1000) {
        // Add full seconds, not just increment by 1
        const secondsToAdd = Math.floor(timeOffset / 1000);
        locationTime.setSeconds(locationTime.getSeconds() + secondsToAdd);
        timeOffset -= secondsToAdd * 1000;
    }
    
    // Get the current second to prevent updating the same second twice
    const currentSecond = locationTime.getSeconds();
    
    // Only update if the second has changed or we're forcing an update
    if (forceUpdate || currentSecond !== lastSecondUpdated) {
        lastSecondUpdated = currentSecond;
        
        // Format the time and date strings
        const timeString = locationTime.toLocaleTimeString();
        const dateString = locationTime.toLocaleDateString(undefined, { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        // Update the UI
        document.getElementById('current-time').textContent = timeString;
        document.getElementById('current-date').textContent = dateString;
        
        // Log time transitions around minute boundaries for debugging
        if (oldSeconds > 50 && currentSecond < 10) {
            console.log(`Minute boundary crossed: ${oldMinutes}:${oldSeconds} -> ${locationTime.getMinutes()}:${currentSecond}`);
        }
        
        // Update prayer window info at minute changes or if forced
        if (forceUpdate || (oldSeconds > 55 && currentSecond < 5)) {
            updatePrayerWindowDisplay();
        }
    }
}

// Initialize settings from localStorage if available
function initializeSettings() {
    const savedSettings = localStorage.getItem('prayerSettings');
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
        
        // Update the UI to reflect the saved settings
        if (document.getElementById('calculationMethod')) {
            document.getElementById('calculationMethod').value = settings.calculationMethod;
        }
        if (document.getElementById('juristicSchool')) {
            document.getElementById('juristicSchool').value = settings.juristicSchool;
        }
        if (document.getElementById('latitudeMethod')) {
            document.getElementById('latitudeMethod').value = settings.latitudeMethod;
        }
        if (document.getElementById('midnightMode')) {
            document.getElementById('midnightMode').value = settings.midnightMode;
        }
        
        // Set tune values if they exist
        if (settings.tune) {
            document.getElementById('tuneImsak').value = settings.tune.imsak || 0;
            document.getElementById('tuneFajr').value = settings.tune.fajr || 0;
            document.getElementById('tuneSunrise').value = settings.tune.sunrise || 0;
            document.getElementById('tuneDhuhr').value = settings.tune.dhuhr || 0;
            document.getElementById('tuneAsr').value = settings.tune.asr || 0;
            document.getElementById('tuneSunset').value = settings.tune.sunset || 0;
            document.getElementById('tuneMaghrib').value = settings.tune.maghrib || 0;
            document.getElementById('tuneIsha').value = settings.tune.isha || 0;
            document.getElementById('tuneMidnight').value = settings.tune.midnight || 0;
        }
    }
    
    const savedLocation = localStorage.getItem('userLocation');
    if (savedLocation) {
        userLocation = JSON.parse(savedLocation);
    }
    
    // Explicitly call fetchCalculationMethods
    fetchCalculationMethods();
}

// Populate calculation methods dropdown - improved for mobile
function populateCalculationMethods(methods) {
    const select = document.getElementById('calculationMethod');
    if (!select) {
        console.error('Calculation method select element not found');
        return;
    }
    
    // Clear existing options first
    select.innerHTML = '';
    
    // Make sure we have methods to add
    if (!methods || Object.keys(methods).length === 0) {
        console.error('No calculation methods received');
        
        // Add some default methods as fallback
        const defaultMethods = [
            { id: "2", name: "Islamic Society of North America" },
            { id: "3", name: "Muslim World League" },
            { id: "4", name: "Umm Al-Qura University, Makkah" },
            { id: "5", name: "Egyptian General Authority of Survey" },
            { id: "1", name: "University of Islamic Sciences, Karachi" },
            { id: "7", name: "Institute of Geophysics, University of Tehran" },
            { id: "12", name: "Jafari" }
        ];
        
        defaultMethods.forEach(method => {
            const option = document.createElement('option');
            option.value = method.id;
            option.textContent = method.name;
            select.appendChild(option);
            
            // Select the saved method if it matches
            if (settings.calculationMethod == method.id) {
                option.selected = true;
            }
        });
        
        return;
    }
    
    // Add each method as an option
    for (const key in methods) {
        if (methods.hasOwnProperty(key)) {
            const method = methods[key];
            const option = document.createElement('option');
            option.value = method.id;
            option.textContent = method.name;
            select.appendChild(option);
            
            // Select the saved method if it matches
            if (settings.calculationMethod == method.id) {
                option.selected = true;
            }
        }
    }
}

// Fetch calculation methods from Aladhan API with error handling
function fetchCalculationMethods() {
    console.log('Fetching calculation methods...');
    
    fetch('https://api.aladhan.com/v1/methods')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Calculation methods received:', data);
            if (data.code === 200 && data.data) {
                populateCalculationMethods(data.data);
            } else {
                console.error('Invalid API response:', data);
                populateCalculationMethods(null); // Use fallback
            }
        })
        .catch(error => {
            console.error('Error fetching calculation methods:', error);
            populateCalculationMethods(null); // Use fallback
        });
}

// Show settings updated message
function showSettingsUpdated() {
    const applyButton = document.getElementById('applySettings');
    const originalText = applyButton.textContent;
    
    // Change button text but keep it gold
    applyButton.textContent = 'Settings Updated!';
    
    // Reset after 2 seconds
    setTimeout(() => {
        applyButton.textContent = originalText;
    }, 2000);
}

// Setup all event listeners
function setupEventListeners() {
    // Open settings panel
    document.getElementById('openSettings').addEventListener('click', function() {
        openSettingsPanel();
    });
    
    // Close settings panel
    document.getElementById('closeSettings').addEventListener('click', function() {
        closeSettingsPanel();
    });
    
    // Close settings when clicking on backdrop
    document.getElementById('settingsBackdrop').addEventListener('click', function() {
        closeSettingsPanel();
    });
    
    // Apply settings
    document.getElementById('applySettings').addEventListener('click', function() {
        saveSettings();
        fetchPrayerTimes();
        fetchCurrentTime(); // Also update the time when settings change
        closeSettingsPanel();
    });
    
    // Location search
    const locationInput = document.getElementById('locationSearch');
    locationInput.addEventListener('input', debounce(handleLocationSearch, 300));
    
    // Get current location
    document.getElementById('getCurrentLocation').addEventListener('click', getCurrentLocation);
    
    // Handle Escape key to close settings
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeSettingsPanel();
        }
    });
    
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', function() {
            if (this.checked) {
                document.body.classList.add('light-theme');
                localStorage.setItem('theme', 'light');
            } else {
                document.body.classList.remove('light-theme');
                localStorage.setItem('theme', 'dark');
            }
        });
    }
    
    // Add this to debug your buttons
    console.log("Setting up event listeners...");
    document.getElementById('openSettings').addEventListener('click', function() {
        console.log("Settings button clicked");
        openSettingsPanel();
    });

    document.getElementById('themeToggle').addEventListener('change', function() {
        console.log("Theme toggle changed");
        // Theme toggle code...
    });
}

// Open settings panel
function openSettingsPanel() {
    const panel = document.getElementById('settingsPanel');
    const backdrop = document.getElementById('settingsBackdrop');
    
    // Show backdrop
    backdrop.style.display = 'block';
    setTimeout(() => {
        backdrop.classList.add('open');
    }, 10);
    
    // Slide in panel
    setTimeout(() => {
        panel.classList.add('open');
    }, 50);
    
    // Keep scrolling enabled but prevent interactions with main content
    document.body.style.overflow = 'auto';
}

// Close settings panel
function closeSettingsPanel() {
    const panel = document.getElementById('settingsPanel');
    const backdrop = document.getElementById('settingsBackdrop');
    
    // Slide the panel out
    panel.classList.remove('open');
    
    // Hide backdrop
    backdrop.classList.remove('open');
    setTimeout(() => {
        backdrop.style.display = 'none';
    }, 300);
}

// Get initial data (location and prayer times)
function getInitialData() {
    updateLocationDisplay();
    fetchPrayerTimes();
    fetchCurrentTime(); // This will now properly manage its own intervals
}

// Initialize the app - Main entry point
document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme - should be called before other UI code
    initializeTheme();
    
    // Setup theme toggle
    setupThemeToggle();
    
    // Initialize settings
    initializeSettings();
    
    // Initialize theme
    initializeTheme();
    
    // Setup event listeners
    setupEventListeners();
    
    // Check if this is first load or if we don't have a saved location
    if (!localStorage.getItem('userLocation')) {
        // First time visit - show location prompt
        showLocationPrompt();
    } else {
        // Get initial data
        getInitialData();
    }
    
    // Hide location suggestions when clicking outside
    document.addEventListener('click', function(event) {
        const suggestionsContainer = document.getElementById('locationSuggestions');
        const locationSearch = document.getElementById('locationSearch');
        
        if (suggestionsContainer && locationSearch && 
            !locationSearch.contains(event.target) && 
            !suggestionsContainer.contains(event.target)) {
            suggestionsContainer.classList.add('hidden');
        }
    });
    
    // Make sure settings panel is visible initially
    document.getElementById('settingsPanel').classList.remove('hidden');
    
    // Make sure backdrop is properly hidden initially
    const backdrop = document.getElementById('settingsBackdrop');
    backdrop.style.display = 'none';
});

// Initialize theme from localStorage
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeToggle = document.getElementById('themeToggle');
    
    const isLightTheme = savedTheme === 'light';
    
    if (isLightTheme) {
        document.documentElement.classList.add('light-theme');
        document.body.classList.add('light-theme');
        if (themeToggle) themeToggle.checked = true;
    }
    
    // Initialize scrollbar theme
    updateScrollbarTheme(isLightTheme);
}

// Show location prompt to the user
function showLocationPrompt() {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-gray-900/80 flex items-center justify-center z-50';
    modal.id = 'location-prompt';
    
    modal.innerHTML = `
        <div class="bg-gray-800 p-6 rounded-xl max-w-md w-full mx-4 border border-gold-600/20">
            <h2 class="text-xl font-semibold text-gold mb-4">Welcome to Prayer Times</h2>
            <p class="text-gray-300 mb-4">Please allow access to your location or enter it manually for accurate prayer times.</p>
            <div class="space-y-3">
                <button id="prompt-geolocation" class="w-full flex items-center justify-center px-4 py-2 bg-gold text-gray-900 rounded-md hover:bg-gold-600 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                    </svg>
                    Use My Location
                </button>
                <div class="relative">
                    <input type="text" id="prompt-location-input" placeholder="Or type your city/address" 
                        class="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent">
                    <div id="prompt-location-suggestions" class="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-md shadow-lg hidden">
                        <!-- Suggestions will be added here -->
                    </div>
                </div>
                <button id="prompt-manual-location" class="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors">
                    Enter Manually
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Set up event listeners for the prompt
    document.getElementById('prompt-geolocation').addEventListener('click', function() {
        // This button needs to use a special version of getCurrentLocation that updates immediately
        getLocationAndUpdate();
        document.getElementById('location-prompt').remove();
    });
    
    // Add suggestions as the user types
    document.getElementById('prompt-location-input').addEventListener('input', debounce(function() {
        const searchTerm = this.value.trim();
        const suggestionsContainer = document.getElementById('prompt-location-suggestions');
        
        if (searchTerm.length < 2) {
            suggestionsContainer.classList.add('hidden');
            return;
        }
        
        // Use OpenStreetMap Nominatim API for geocoding
        const apiUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&limit=5`;
        
        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                suggestionsContainer.innerHTML = '';
                
                if (data.length === 0) {
                    suggestionsContainer.innerHTML = '<div class="p-2 text-sm text-gray-400">No results found</div>';
                    suggestionsContainer.classList.remove('hidden');
                    return;
                }
                
                data.forEach(place => {
                    const suggestion = document.createElement('div');
                    suggestion.className = 'p-2 hover:bg-gray-600 cursor-pointer';
                    suggestion.textContent = place.display_name;
                    
                    suggestion.addEventListener('click', () => {
                        document.getElementById('prompt-location-input').value = place.display_name;
                        suggestionsContainer.classList.add('hidden');
                        
                        // Update user location
                        userLocation = {
                            city: place.display_name.split(',')[0],
                            country: place.display_name.split(',').pop().trim(),
                            latitude: parseFloat(place.lat),
                            longitude: parseFloat(place.lon)
                        };
                        
                        // Save to localStorage
                        localStorage.setItem('userLocation', JSON.stringify(userLocation));
                        
                        // Update UI
                        updateLocationDisplay();
                        fetchPrayerTimes();
                        fetchCurrentTime();
                        
                        // Remove the modal
                        document.getElementById('location-prompt').remove();
                    });
                    
                    suggestionsContainer.appendChild(suggestion);
                });
                
                suggestionsContainer.classList.remove('hidden');
            })
            .catch(error => {
                console.error('Geocoding Error:', error);
                suggestionsContainer.innerHTML = '<div class="p-2 text-sm text-gray-400">An error occurred. Please try again.</div>';
                suggestionsContainer.classList.remove('hidden');
            });
    }, 300));
    
    document.getElementById('prompt-manual-location').addEventListener('click', function() {
        const locationInput = document.getElementById('prompt-location-input').value.trim();
        if (locationInput.length > 0) {
            // Use the entered location
            searchPromptLocation(locationInput);
        } else {
            showError('Please enter a location or use geolocation');
        }
    });
    
    // Also submit when pressing enter in the input field
    document.getElementById('prompt-location-input').addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            const locationInput = this.value.trim();
            if (locationInput.length > 0) {
                searchPromptLocation(locationInput);
            } else {
                showError('Please enter a location or use geolocation');
            }
        }
    });
    
    // Hide suggestions when clicking outside
    document.addEventListener('click', function(event) {
        const suggestionsContainer = document.getElementById('prompt-location-suggestions');
        const input = document.getElementById('prompt-location-input');
        
        if (suggestionsContainer && input && 
            !input.contains(event.target) && 
            !suggestionsContainer.contains(event.target)) {
            suggestionsContainer.classList.add('hidden');
        }
    });
}

// New function - Get current location and apply immediately for first time setup
function getLocationAndUpdate() {
    if (navigator.geolocation) {
        // Show a temporary loading message
        showTemporaryMessage('Detecting your location...');
        
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                // Get location name and update immediately (instead of using tempLocation)
                const apiUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
                
                fetch(apiUrl)
                    .then(response => response.json())
                    .then(data => {
                        const address = data.address;
                        
                        // Try to get the most specific location name available
                        const city = address.city || address.town || address.village || address.hamlet || 
                                    address.suburb || address.county || address.state_district || 
                                    address.state || data.name || "Location";
                        
                        const country = address.country || "";
                        
                        // Log address data for debugging
                        console.log("Address data:", address);
                        
                        // Directly update user location instead of using tempLocation
                        userLocation = {
                            city: city,
                            country: country,
                            latitude: lat,
                            longitude: lon
                        };
                        
                        // Save to localStorage
                        localStorage.setItem('userLocation', JSON.stringify(userLocation));
                        
                        // Update the interface
                        updateLocationDisplay();
                        fetchPrayerTimes();
                        fetchCurrentTime();
                        
                        showTemporaryMessage('Location updated!', 'success');
                    })
                    .catch(error => {
                        console.error('Reverse Geocoding Error:', error);
                        
                        // Use coordinates as location name when geocoding fails
                        userLocation = {
                            city: `Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
                            country: '',
                            latitude: lat,
                            longitude: lon
                        };
                        
                        // Save to localStorage
                        localStorage.setItem('userLocation', JSON.stringify(userLocation));
                        
                        // Update the interface
                        updateLocationDisplay();
                        fetchPrayerTimes();
                        fetchCurrentTime();
                        
                        showTemporaryMessage('Location coordinates saved!', 'success');
                    });
            },
            function(error) {
                console.error('Geolocation Error:', error);
                showError('Unable to retrieve your location. Please enter it manually.');
            }
        );
    } else {
        showError('Geolocation is not supported by your browser. Please enter your location manually.');
    }
}

// Show a temporary message (reuse error message element but with different styling)
function showTemporaryMessage(message, type = 'info') {
    // Create message element if it doesn't exist
    let messageElement = document.getElementById('temp-message');
    
    if (!messageElement) {
        messageElement = document.createElement('div');
        messageElement.id = 'temp-message';
        messageElement.className = 'fixed top-4 right-4 p-4 rounded-md shadow-lg z-50 transition-opacity';
        document.body.appendChild(messageElement);
    }
    
    // Set color based on message type
    if (type === 'success') {
        messageElement.className = 'fixed top-4 right-4 bg-green-600 text-white p-4 rounded-md shadow-lg z-50 transition-opacity';
    } else if (type === 'info') {
        messageElement.className = 'fixed top-4 right-4 bg-blue-600 text-white p-4 rounded-md shadow-lg z-50 transition-opacity';
    }
    
    // Set message and show
    messageElement.textContent = message;
    messageElement.style.display = 'block';
    messageElement.style.opacity = '1';
    
    // Hide after 3 seconds
    setTimeout(() => {
        messageElement.style.opacity = '0';
        setTimeout(() => {
            messageElement.style.display = 'none';
        }, 300);
    }, 3000);
}

// Search for a location from the prompt
function searchPromptLocation(query) {
    const apiUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                const place = data[0];
                
                // Update user location
                userLocation = {
                    city: place.display_name.split(',')[0],
                    country: place.display_name.split(',').pop().trim(),
                    latitude: parseFloat(place.lat),
                    longitude: parseFloat(place.lon)
                };
                
                // Save to localStorage
                localStorage.setItem('userLocation', JSON.stringify(userLocation));
                
                // Update display and fetch times
                updateLocationDisplay();
                fetchPrayerTimes();
                fetchCurrentTime();
                
                // Remove the modal
                document.getElementById('location-prompt').remove();
            } else {
                showError('Location not found. Please try another search.');
            }
        })
        .catch(error => {
            console.error('Location Search Error:', error);
            showError('Error searching for location. Please try again.');
        });
}

// Clean up when the page is unloaded to prevent memory leaks
window.addEventListener('beforeunload', function() {
    // Clear any running intervals
    if (locationTimeInterval) {
        clearInterval(locationTimeInterval);
        locationTimeInterval = null;
    }
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pageshow', handlePageShow);
    window.removeEventListener('focus', handleFocus);
});

// Check if a time is between start and end times
function isTimeBetween(time, start, end) {
    // Convert all times to minutes since midnight for easier comparison
    const timeMinutes = timeToMinutes(time);
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    
    // Handle day boundary cases
    if (startMinutes <= endMinutes) {
        // Simple case: start is before end
        return timeMinutes >= startMinutes && timeMinutes < endMinutes;
    } else {
        // Complex case: end is on the next day (e.g. Isha to Fajr)
        return timeMinutes >= startMinutes || timeMinutes < endMinutes;
    }
}

// Update the HTML title to reflect the Salah terminology
document.title = "Salah Times";

// Setup theme toggle event listeners
function setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', function() {
            console.log("Theme toggle changed");
            
            // Save current scroll position
            const scrollPosition = window.scrollY;
            
            const isLightTheme = this.checked;
            
            // Update theme classes
            if (isLightTheme) {
                document.documentElement.classList.add('light-theme');
                document.body.classList.add('light-theme');
                localStorage.setItem('theme', 'light');
                
                // Directly update the settings icon color for light theme
                const settingsIcon = document.querySelector('#openSettings svg');
                if (settingsIcon) settingsIcon.setAttribute('fill', '#755c11');
            } else {
                document.documentElement.classList.remove('light-theme');
                document.body.classList.remove('light-theme');
                localStorage.setItem('theme', 'dark');
                
                // Directly update the settings icon color for dark theme
                const settingsIcon = document.querySelector('#openSettings svg');
                if (settingsIcon) settingsIcon.setAttribute('fill', '#d4af37');
            }
            
            // Force scrollbar theme update
            updateScrollbarTheme(isLightTheme);
            
            // Remove the forced repaint that resets scroll position
            // document.body.style.display = 'none';
            // document.body.offsetHeight;
            // document.body.style.display = '';
            
            // Restore scroll position
            window.scrollTo(0, scrollPosition);
        });
    }
}

// Also update the initializeTheme function to set the initial icon color
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeToggle = document.getElementById('themeToggle');
    
    const isLightTheme = savedTheme === 'light';
    
    if (isLightTheme) {
        document.documentElement.classList.add('light-theme');
        document.body.classList.add('light-theme');
        if (themeToggle) themeToggle.checked = true;
        
        // Set the initial icon color for light theme
        const settingsIcon = document.querySelector('#openSettings svg');
        if (settingsIcon) settingsIcon.setAttribute('fill', '#755c11');
    } else {
        // Set the initial icon color for dark theme
        const settingsIcon = document.querySelector('#openSettings svg');
        if (settingsIcon) settingsIcon.setAttribute('fill', '#d4af37');
    }
    
    // Initialize scrollbar theme
    updateScrollbarTheme(isLightTheme);
}

// Add a new function to force immediate update of icon color when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // All other initialization code...
    
    // Ensure settings icon has correct color
    const isLightTheme = document.body.classList.contains('light-theme');
    const settingsIcon = document.querySelector('#openSettings svg');
    if (settingsIcon) {
        settingsIcon.setAttribute('fill', isLightTheme ? '#755c11' : '#d4af37');
    }
});

// Fix the syntax error by adding the required closing bracket
// Check the end of your file and add:

// When adding the last few functions, you likely forgot to close something
function updatePrayerWindowDisplay() {
    // Get current prayer window data
    if (window.prayerTimesData && window.prayerTimesData.timings && locationTime) {
        const currentHour = locationTime.getHours();
        const currentMinute = locationTime.getMinutes();
        const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
        
        // Get the prayer times grid element
        const prayerTimesGrid = document.getElementById('prayer-times-grid');
        if (prayerTimesGrid) {
            // Fix: Pass the correct data structure
            displayPrayerTimes({timings: window.prayerTimesData.timings}, currentTimeStr);
        }
    }
}

// Add this function to your script.js file
function updateScrollbarTheme(isLightTheme) {
    // Create or get existing style element for scrollbar styles
    let styleEl = document.getElementById('scrollbar-styles');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'scrollbar-styles';
        document.head.appendChild(styleEl);
    }
    
    // Set appropriate styles based on theme
    if (isLightTheme) {
        styleEl.textContent = `
            ::-webkit-scrollbar { width: 10px; height: 10px; }
            ::-webkit-scrollbar-track { background-color: #ffffff !important; }
            ::-webkit-scrollbar-thumb { 
                background-color: #8b6d14 !important; 
                border-radius: 5px;
                border: 2px solid #ffffff !important;
            }
            ::-webkit-scrollbar-corner { background-color: #ffffff !important; }
            * { scrollbar-color: #8b6d14 #ffffff !important; }
        `;
    } else {
        styleEl.textContent = `
            ::-webkit-scrollbar { width: 10px; height: 10px; }
            ::-webkit-scrollbar-track { background-color: #1f2937 !important; }
            ::-webkit-scrollbar-thumb { 
                background-color: #d4af37 !important; 
                border-radius: 5px;
                border: 2px solid #1f2937 !important;
            }
            ::-webkit-scrollbar-corner { background-color: #1f2937 !important; }
            * { scrollbar-color: #d4af37 #1f2937 !important; }
        `;
    }
}

// Calculate Tahajjud time (last third of the night)
function calculateTahajjudTime(timings) {
    // If we don't have the necessary prayer times, return null
    if (!timings || !timings.Maghrib || !timings.Fajr) {
        return null;
    }
    
    // Convert times to minutes for easier calculation
    const maghribMinutes = timeToMinutes(timings.Maghrib);
    let fajrMinutes = timeToMinutes(timings.Fajr);
    
    // Handle day boundary (Fajr is on the next day)
    if (fajrMinutes < maghribMinutes) {
        fajrMinutes += 24 * 60; // Add 24 hours in minutes
    }
    
    // Calculate night duration in minutes
    const nightDuration = fajrMinutes - maghribMinutes;
    
    // Calculate when the last third begins (maghrib + 2/3 of night)
    const lastThirdStart = maghribMinutes + Math.floor(nightDuration * (2/3));
    
    // Convert back to HH:MM format, handling day boundary
    const adjustedMinutes = lastThirdStart % (24 * 60);
    const hours = Math.floor(adjustedMinutes / 60);
    const minutes = adjustedMinutes % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    });
}

// PWA Installation logic
let deferredPrompt;
const installContainer = document.createElement('div');
installContainer.className = 'fixed bottom-4 right-4 z-40 hidden';
installContainer.innerHTML = `
    <button id="installApp" class="px-4 py-2 bg-gold text-gray-900 rounded-md shadow-lg flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Install App
    </button>
`;
document.body.appendChild(installContainer);

// Listen for the beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    // Show the install button
    installContainer.classList.remove('hidden');
});

// Add click event after the container is added to the DOM
document.getElementById('installApp').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    // Clear the saved prompt since it can't be used again
    deferredPrompt = null;
    
    // Hide the install button
    installContainer.classList.add('hidden');
});

// Listen for successful installation
window.addEventListener('appinstalled', (evt) => {
    // App was installed, log or show a message
    console.log('Salah Times was installed to the home screen');
    showTemporaryMessage('App installed successfully!', 'success');
    // Hide the install button
    installContainer.classList.add('hidden');
});
