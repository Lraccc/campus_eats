import React, { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { LatLng } from 'react-native-maps';

type Props = {
  height?: number;
  userLocation: LatLng;            // customer (U)
  dasherLocation?: LatLng | null;  // dasher (D)
};

const LeafletMap: React.FC<Props> = ({ height = 300, userLocation, dasherLocation }) => {
  const webRef = useRef<WebView>(null);

  const html = useMemo(() => `
<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#map{height:100%;margin:0}
.leaflet-container { background: #f9f9f9; }
.badge{width:18px;height:18px;border-radius:9px;box-shadow:0 1px 2px rgba(0,0,0,0.3)}
.badge.u{background:#BC4A4D}
.badge.d{background:#3498db}
</style>
</head><body><div id="map"></div>
<script>
  const uLat = ${userLocation.latitude};
  const uLng = ${userLocation.longitude};
  const hasD = ${dasherLocation ? 'true' : 'false'};
  const dLat = ${dasherLocation ? dasherLocation.latitude : 0};
  const dLng = ${dasherLocation ? dasherLocation.longitude : 0};

  const map = L.map('map', { zoomControl: false }).setView([uLat, uLng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

  const uIcon = L.divIcon({html:'<div class="badge u"></div>', iconSize:[18,18], iconAnchor:[9,9]});
  const dIcon = L.divIcon({html:'<div class="badge d"></div>', iconSize:[18,18], iconAnchor:[9,9]});

  const u = L.marker([uLat, uLng], { icon: uIcon }).addTo(map);
  let d = null;
  if (hasD) {
    d = L.marker([dLat, dLng], { icon: dIcon }).addTo(map);
  }

  // Draw line if both exist
  if (hasD) {
    const line = L.polyline([[uLat, uLng], [dLat, dLng]], { color: '#BC4A4D', weight: 3, dashArray: '10,10' }).addTo(map);
    map.fitBounds(line.getBounds(), { padding: [40, 40] });
  } else {
    map.setView([uLat, uLng], 15);
  }
</script></body></html>
`, [userLocation.latitude, userLocation.longitude, dasherLocation?.latitude, dasherLocation?.longitude]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', borderRadius: 12, overflow: 'hidden' },
});

export default LeafletMap;