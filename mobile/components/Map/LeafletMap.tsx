import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LatLng } from 'react-native-maps';
import { WebView } from 'react-native-webview';

type FocusTarget = 'user' | 'dasher' | 'both';

type Props = {
  height?: number;
  userLocation: LatLng;
  dasherLocation?: LatLng | null;
  focusOn?: FocusTarget;
};

const LeafletMap: React.FC<Props> = ({ height = 300, userLocation, dasherLocation, focusOn = 'both' }) => {
  const webRef = useRef<WebView>(null);

  const html = useMemo(() => {
    const hasD = !!dasherLocation;
    const uLat = userLocation.latitude;
    const uLng = userLocation.longitude;
    const dLat = hasD ? dasherLocation!.latitude : 0;
    const dLng = hasD ? dasherLocation!.longitude : 0;
    const focus = focusOn;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; }
    .leaflet-div-icon, .leaflet-marker-icon { background: transparent !important; border: none !important; box-shadow: none !important; }
    .badge { width: 20px; height: 20px; border-radius: 10px; display:flex; align-items:center; justify-content:center;
      font:bold 10px/1 Arial; color:#fff; border:1px solid #fff; position:relative; box-shadow:0 1.5px 3px rgba(0,0,0,0.3); }
    .badge.u { background:#BC4A4D; }
    .badge.pulse::after, .badge.pulse::before {
      content:''; position:absolute; inset:-6px; border-radius:50%;
      opacity:0; animation:pulseRing 2.2s infinite;
      will-change: transform, opacity; transform: translateZ(0);
      pointer-events:none; z-index:0;
    }
    .badge.pulse::before { animation-delay:1.1s; }
    .badge.u.pulse::after, .badge.u.pulse::before { background:rgba(188,74,77,0.22); }
    .badge.d { background:#3498db; }
    .badge.d.pulse::after, .badge.d.pulse::before { background:rgba(52,152,219,0.20); }
    @keyframes pulseRing {
      0% { transform: scale(0.55); opacity: 0.75; }
      70% { transform: scale(1.35); opacity: 0; }
      100% { transform: scale(1.35); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const uLat = ${uLat};
    const uLng = ${uLng};
    const hasD = ${hasD ? 'true' : 'false'};
    const dLat = ${dLat};
    const dLng = ${dLng};
    const focusOn = '${focus}';

    const map = L.map('map', { zoomControl:false, attributionControl:true }).setView([uLat, uLng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

    const uIcon = L.divIcon({ html:'<div class="badge u pulse">U</div>', iconSize:[20,20], iconAnchor:[10,10], className:'' });
    const dIcon = L.divIcon({ html:'<div class="badge d pulse">D</div>', iconSize:[20,20], iconAnchor:[10,10], className:'' });

    const userMarker = L.marker([uLat, uLng], { icon: uIcon }).addTo(map).bindPopup('User');
    let dasherMarker = null;
    let connectionLine = null;

    if (hasD) {
      dasherMarker = L.marker([dLat, dLng], { icon: dIcon }).addTo(map).bindPopup('Dasher');
      connectionLine = L.polyline([[uLat, uLng],[dLat, dLng]], { color:'#BC4A4D', weight:3, opacity:0.7, dashArray:'6,6' }).addTo(map);
    }

    function applyFocus(){
      const zoom = 17;
      if (focusOn === 'dasher' && dasherMarker) { const d = dasherMarker.getLatLng(); map.setView([d.lat,d.lng], zoom, {animate:true}); return; }
      if (focusOn === 'user') { const u = userMarker.getLatLng(); map.setView([u.lat,u.lng], zoom, {animate:true}); return; }
      if (dasherMarker) { const u=userMarker.getLatLng(), d=dasherMarker.getLatLng(); map.fitBounds(L.latLngBounds([u,d]), {padding:[32,32]}); }
      else { const u=userMarker.getLatLng(); map.setView([u.lat,u.lng], 15, {animate:true}); }
    }
    applyFocus();

    function updateMarkers(payload){
      try{
        if (payload.userLocation){
          const nu=parseFloat(payload.userLocation.latitude), lu=parseFloat(payload.userLocation.longitude);
          if(!Number.isNaN(nu) && !Number.isNaN(lu)) userMarker.setLatLng([nu,lu]);
        }
        if (payload.dasherLocation){
          const nd=parseFloat(payload.dasherLocation.latitude), ld=parseFloat(payload.dasherLocation.longitude);
          if(!Number.isNaN(nd) && !Number.isNaN(ld)){
            if(!dasherMarker){
              dasherMarker=L.marker([nd,ld],{icon:dIcon}).addTo(map).bindPopup('Dasher');
            } else {
              dasherMarker.setLatLng([nd,ld]);
            }
          }
        }
        // update or create line
        if (dasherMarker){
          const uPos = userMarker.getLatLng();
          const dPos = dasherMarker.getLatLng();
          if (!connectionLine){
            connectionLine = L.polyline([[uPos.lat, uPos.lng],[dPos.lat, dPos.lng]], { color:'#BC4A4D', weight:3, opacity:0.7, dashArray:'6,6' }).addTo(map);
          } else {
            connectionLine.setLatLngs([[uPos.lat, uPos.lng],[dPos.lat, dPos.lng]]);
          }
        }

        // Always refocus/zoom to dasher on updates when focusOn === 'dasher'
        if (dasherMarker && focusOn === 'dasher'){
          const d = dasherMarker.getLatLng();
          map.setView([d.lat, d.lng], 17, { animate:true });
        } else {
          applyFocus();
        }
      }catch(e){ console.error(e); }
    }

    window.addEventListener('message',(event)=>{
      try{
        const data = JSON.parse(event.data);
        if (data && data.type === 'UPDATE_LOCATIONS') updateMarkers(data);
      }catch(e){ console.error('parse', e); }
    });

    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type:'MAP_READY'}));
  </script>
</body>
</html>
    `;
  }, [userLocation.latitude, userLocation.longitude, dasherLocation?.latitude, dasherLocation?.longitude, focusOn]);


  useEffect(() => {
    if (!webRef.current) return;
    const payload = {
      type: 'UPDATE_LOCATIONS',
      userLocation: userLocation ? { latitude: userLocation.latitude, longitude: userLocation.longitude } : undefined,
      dasherLocation: dasherLocation ? { latitude: dasherLocation.latitude, longitude: dasherLocation.longitude } : undefined,
    };
    webRef.current.postMessage(JSON.stringify(payload));
  }, [userLocation, dasherLocation]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        style={{ flex: 1 }}
        javaScriptEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs
        domStorageEnabled
        automaticallyAdjustContentInsets={false}
        setSupportMultipleWindows={false}
        mixedContentMode="always"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', borderRadius: 12, overflow: 'hidden' },
});

export default LeafletMap;