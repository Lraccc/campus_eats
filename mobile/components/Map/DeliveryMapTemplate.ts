// Template for the Leaflet map
export const createDeliveryMapTemplate = (
  userLatitude: string,
  userLongitude: string,
  dasherLatitude: string | null = null,
  dasherLongitude: string | null = null
): string => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Delivery Tracking Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <style>
    body {
      padding: 0;
      margin: 0;
    }
    html, body, #map {
      height: 100%;
      width: 100%;
    }
    .info-box {
      padding: 10px;
      background: white;
      border-radius: 5px;
      box-shadow: 0 0 15px rgba(0,0,0,0.2);
      position: absolute;
      bottom: 10px;
      left: 10px;
      z-index: 1000;
      max-width: 200px;
      font-family: Arial, sans-serif;
    }
    .info-title {
      font-weight: bold;
      margin-bottom: 5px;
      color: #BC4A4D;
    }
    .info-content {
      font-size: 14px;
      color: #333;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="info-box">
    <div class="info-title">Delivery Status</div>
    <div class="info-content" id="status-info">Tracking delivery...</div>
  </div>

  <script>
    // Parse initial coordinates from template parameters
    const userLatitude = parseFloat('${userLatitude}');
    const userLongitude = parseFloat('${userLongitude}');
    let dasherLatitude = ${dasherLatitude ? `parseFloat('${dasherLatitude}')` : 'null'};
    let dasherLongitude = ${dasherLongitude ? `parseFloat('${dasherLongitude}')` : 'null'};
    
    // Initialize map centered on user
    const map = L.map('map').setView([userLatitude, userLongitude], 15);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Create custom icons for markers
    const userIcon = L.divIcon({
      className: 'user-marker',
      html: '<div class="user-marker-circle"><div class="user-marker-dot"></div></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    
    const dasherIcon = L.divIcon({
      className: 'dasher-marker',
      html: '<div class="dasher-marker-circle"><div class="dasher-marker-dot"></div></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    
    // Using the same style as user marker for static destination marker
    const destinationIcon = L.divIcon({
      className: 'user-marker',
      html: '<div class="user-marker-circle"><div class="user-marker-dot"></div></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    
    // Add user marker
    const userMarker = L.marker([userLatitude, userLongitude], {icon: userIcon})
      .addTo(map)
      .bindPopup('Your Location');
    
    // Add static destination marker
    const destinationMarker = L.marker([10.2944327, 123.8812167], {icon: destinationIcon})
      .addTo(map)
      .bindPopup('Destination');
    
    // Add dasher marker if coordinates available
    let dasherMarker;
    if (dasherLatitude && dasherLongitude) {
      dasherMarker = L.marker([dasherLatitude, dasherLongitude], {icon: dasherIcon})
        .addTo(map)
        .bindPopup('Dasher Location');
      
      // Draw lines between user, dasher, and destination
      const userDasherLine = L.polyline(
        [[userLatitude, userLongitude], [dasherLatitude, dasherLongitude]],
        {color: '#BC4A4D', weight: 3, opacity: 0.7, dashArray: '10, 10'}
      ).addTo(map);
      
      // Draw line to destination
      const destinationLine = L.polyline(
        [[dasherLatitude, dasherLongitude], [10.3120896, 123.9154688]],
        {color: '#228B22', weight: 3, opacity: 0.7, dashArray: '10, 10'}
      ).addTo(map);
      
      // Calculate distance
      const distance = calculateDistance(
        userLatitude, userLongitude,
        dasherLatitude, dasherLongitude
      );
      
      document.getElementById('status-info').innerText = 
        \`Dasher is approximately \${distance.toFixed(1)} km away\`;
    } else {
      document.getElementById('status-info').innerText = 
        'Waiting for dasher location...';
    }
    
    // Function to calculate distance in kilometers using Haversine formula
    function calculateDistance(lat1, lon1, lat2, lon2) {
      const R = 6371; // Earth's radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }
    
    // Setup message listener for updates from React Native
    window.addEventListener('message', function(event) {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'UPDATE_LOCATIONS') {
          // Update user location if provided
          if (message.userLocation) {
            const newUserLat = parseFloat(message.userLocation.latitude);
            const newUserLng = parseFloat(message.userLocation.longitude);
            userMarker.setLatLng([newUserLat, newUserLng]);
          }
          
          // Update dasher location if provided
          if (message.dasherLocation) {
            const newDasherLat = parseFloat(message.dasherLocation.latitude);
            const newDasherLng = parseFloat(message.dasherLocation.longitude);
            
            // If dasher marker doesn't exist yet, create it
            if (!dasherMarker) {
              dasherMarker = L.marker([newDasherLat, newDasherLng], {icon: dasherIcon})
                .addTo(map)
                .bindPopup('Dasher Location');
            } else {
              // Otherwise just update position
              dasherMarker.setLatLng([newDasherLat, newDasherLng]);
            }
            
            // Update route lines
            const userPos = userMarker.getLatLng();
            // Line between user and dasher
            const userDasherLine = L.polyline(
              [[userPos.lat, userPos.lng], [newDasherLat, newDasherLng]],
              {color: '#BC4A4D', weight: 3, opacity: 0.7, dashArray: '10, 10'}
            ).addTo(map);
            
            // Line between dasher and destination
            const destinationLine = L.polyline(
              [[newDasherLat, newDasherLng], [10.3120896, 123.9154688]],
              {color: '#228B22', weight: 3, opacity: 0.7, dashArray: '10, 10'}
            ).addTo(map);
            
            // Update distance
            const distance = calculateDistance(
              userPos.lat, userPos.lng,
              newDasherLat, newDasherLng
            );
            
            document.getElementById('status-info').innerText = 
              \`Dasher is approximately \${distance.toFixed(1)} km away\`;
            
            // Update map view to include all markers
            const bounds = L.latLngBounds(
              L.latLng(userPos.lat, userPos.lng),
              L.latLng(newDasherLat, newDasherLng),
              L.latLng(10.3120896, 123.9154688) // Include static destination marker
            );
            map.fitBounds(bounds, {padding: [50, 50]});
          }
        }
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    });
    
    // Signal that the map is ready
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'MAP_READY'
    }));
  </script>
</body>
</html>
  `;
};
