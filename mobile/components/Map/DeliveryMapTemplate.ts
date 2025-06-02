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
    
    // Custom icons
    const userIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      shadowSize: [41, 41]
    });
    
    const dasherIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      shadowSize: [41, 41]
    });
    
    // Add user marker
    const userMarker = L.marker([userLatitude, userLongitude], {icon: userIcon})
      .addTo(map)
      .bindPopup('Your Location');
    
    // Add dasher marker if coordinates available
    let dasherMarker;
    if (dasherLatitude && dasherLongitude) {
      dasherMarker = L.marker([dasherLatitude, dasherLongitude], {icon: dasherIcon})
        .addTo(map)
        .bindPopup('Dasher Location');
      
      // Draw a line between user and dasher
      const routeLine = L.polyline(
        [[userLatitude, userLongitude], [dasherLatitude, dasherLongitude]],
        {color: '#BC4A4D', weight: 3, opacity: 0.7, dashArray: '10, 10'}
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
            
            // Update route line
            const userPos = userMarker.getLatLng();
            const routeLine = L.polyline(
              [[userPos.lat, userPos.lng], [newDasherLat, newDasherLng]],
              {color: '#BC4A4D', weight: 3, opacity: 0.7, dashArray: '10, 10'}
            ).addTo(map);
            
            // Update distance
            const distance = calculateDistance(
              userPos.lat, userPos.lng,
              newDasherLat, newDasherLng
            );
            
            document.getElementById('status-info').innerText = 
              \`Dasher is approximately \${distance.toFixed(1)} km away\`;
            
            // Update map view to include both markers
            const bounds = L.latLngBounds(
              L.latLng(userPos.lat, userPos.lng),
              L.latLng(newDasherLat, newDasherLng)
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
