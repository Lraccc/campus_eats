import React, { useState, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './css/ImageModal.css'; // You can add custom styling here for modal

const MapModal = ({ isOpen, onClose, setLatitude, setLongitude, latitude, longitude, setGoogleLink }) => {
  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(null);
  const [selectedLat, setSelectedLat] = useState(latitude);
  const [selectedLng, setSelectedLng] = useState(longitude);

  const defaultIcon = new L.Icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png', // Default Leaflet marker
    iconSize: [25, 41], // Size of the marker
    iconAnchor: [12, 41], // Point of the icon which will correspond to the marker's position
    popupAnchor: [1, -34], // Position of the popup relative to the icon
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    shadowSize: [41, 41], // Size of the shadow
    shadowAnchor: [12, 41], // Anchor point for the shadow
  });

  useEffect(() => {
    if (isOpen) {
      // Initialize the map only when the modal is open
      const initialMap = L.map('map').setView([latitude, longitude], 17);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(initialMap);

      // Add click event to map
      initialMap.on('click', (event) => {
        const { lat, lng } = event.latlng;
        setSelectedLat(lat);
        setSelectedLng(lng);

        // Remove existing marker
        if (marker) {
          initialMap.removeLayer(marker);
        }

        // Add new marker
        const newMarker = L.marker([lat, lng], { icon: defaultIcon }).addTo(initialMap);
        setMarker(newMarker);
        console.log(`Latitude: ${lat}, Longitude: ${lng}`);
      });

      setMap(initialMap);

      // Cleanup function to remove map when the component unmounts or modal closes
      return () => {
        if (initialMap) {
          initialMap.remove();
        }
      };
    }
  }, [isOpen]);

  const handleConfirm = () => {
    // When the user clicks Confirm, pass the selected coordinates to the parent
    setLatitude(selectedLat);
    setLongitude(selectedLng);
    setGoogleLink(`https://www.google.com/maps?q=${selectedLat},${selectedLng}`);
    onClose();  // Close the modal after confirming
  };

  if (!isOpen) return null;  // Do not render the modal if not open

  const handleOverlayClick = (e) => {
    // Prevent the modal from closing when clicking inside the map
    e.stopPropagation();
  };

  return (
    <div className="map-modal-overlay" onClick={onClose}>
      <div className="map-modal-content" onClick={handleOverlayClick}>
        <span className="map-close-button" onClick={onClose}>&times;</span>
        <div id="map" style={{ width: '100%', height: '100%' }}></div>

        <button 
          className="confirm-button" 
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            zIndex: 99999,
          }}
          onClick={handleConfirm}
        >
          Confirm
        </button>
      </div>
    </div>
  );
};

export default MapModal;
