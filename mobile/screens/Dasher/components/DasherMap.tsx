// import axios from 'axios';
// import * as Location from 'expo-location';
// import React, { useEffect, useRef, useState } from 'react';
// import { ActivityIndicator, Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
// import { API_URL } from '../../../config';

// interface DasherMapProps {
//   orderId: string;
//   navigation: any;
//   route: any;
// }

// const DasherMap: React.FC<DasherMapProps> = ({ route, navigation }) => {
//   const { orderId } = route.params;
//   const [dasherLocation, setDasherLocation] = useState<any>(null);
//   const [customerLocation, setCustomerLocation] = useState<any>(null);
//   const [order, setOrder] = useState<any>(null);
//   const [routePath, setRoutePath] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
  
//   const mapRef = useRef<MapView | null>(null);
//   const locationSubscription = useRef<any>(null);

//   // Fetch order details to get customer location
//   useEffect(() => {
//     const fetchOrderDetails = async () => {
//       try {
//         const response = await axios.get(`${API_URL}/orders/${orderId}`);
//         const orderData = response.data;
//         setOrder(orderData);

//         // Parse customer location coordinates
//         if (orderData.customerLocation) {
//           const [latitude, longitude] = orderData.customerLocation.split(',').map(Number);
//           setCustomerLocation({ 
//             latitude, 
//             longitude, 
//             latitudeDelta: 0.005, 
//             longitudeDelta: 0.005 
//           });
//         } else {
//           setError("Customer location not available");
//         }
//       } catch (err) {
//         console.error('Error fetching order details:', err);
//         setError("Failed to load order information");
//       }
//     };

//     fetchOrderDetails();
//   }, [orderId]);

//   // Track dasher's location
//   useEffect(() => {
//     const startLocationTracking = async () => {
//       try {
//         let { status } = await Location.requestForegroundPermissionsAsync();
//         if (status !== 'granted') {
//           setError('Location permission denied');
//           return;
//         }

//         // Get initial location
//         let currentLocation = await Location.getCurrentPositionAsync({
//           accuracy: Location.Accuracy.Highest,
//         });

//         const { latitude, longitude } = currentLocation.coords;
//         setDasherLocation({
//           latitude,
//           longitude,
//           latitudeDelta: 0.005,
//           longitudeDelta: 0.005
//         });

//         // Update location in database
//         updateLocationInDatabase(latitude, longitude);

//         // Start watching position
//         locationSubscription.current = await Location.watchPositionAsync(
//           {
//             accuracy: Location.Accuracy.Highest,
//             timeInterval: 5000,
//             distanceInterval: 10,
//           },
//           (newLocation) => {
//             const { latitude, longitude } = newLocation.coords;
//             setDasherLocation({
//               latitude,
//               longitude,
//               latitudeDelta: 0.005,
//               longitudeDelta: 0.005
//             });
            
//             updateLocationInDatabase(latitude, longitude);
//           }
//         );
//       } catch (err) {
//         console.error('Error tracking location:', err);
//         setError('Failed to track location');
//       } finally {
//         setLoading(false);
//       }
//     };

//     // Function to update location in database
//     const updateLocationInDatabase = async (latitude: number, longitude: number) => {
//       try {
//         await axios.post(`${API_URL}/dashers/update-location`, {
//           dasherId: localStorage.getItem('dasherId'), // Adjust based on your auth method
//           orderId: orderId,
//           latitude,
//           longitude,
//         });
//       } catch (err) {
//         console.error('Error updating location:', err);
//       }
//     };

//     startLocationTracking();

//     // Clean up subscription
//     return () => {
//       if (locationSubscription.current) {
//         locationSubscription.current.remove();
//       }
//     };
//   }, [orderId]);

//   // Fetch route when both locations are available
//   useEffect(() => {
//     const getRoute = async () => {
//       if (dasherLocation && customerLocation) {
//         try {
//           const response = await axios.get(
//             `https://router.project-osrm.org/route/v1/driving/` +
//             `${dasherLocation.longitude},${dasherLocation.latitude};` +
//             `${customerLocation.longitude},${customerLocation.latitude}` +
//             `?overview=full&geometries=geojson`
//           );

//           if (response.data && 
//               response.data.routes && 
//               response.data.routes[0] && 
//               response.data.routes[0].geometry && 
//               response.data.routes[0].geometry.coordinates) {
            
//             // Transform coordinates from [lng, lat] to {latitude, longitude}
//             const routeCoordinates = response.data.routes[0].geometry.coordinates.map(
//               (coord: [number, number]) => ({
//                 latitude: coord[1],
//                 longitude: coord[0],
//               })
//             );
            
//             setRoutePath(routeCoordinates);
//           }
//         } catch (err) {
//           console.error('Error fetching route:', err);
//         }
//       }
//     };

//     getRoute();
//   }, [dasherLocation, customerLocation]);

//   // Fit map to show both markers when data is available
//   useEffect(() => {
//     if (mapRef.current && dasherLocation && customerLocation) {
//       mapRef.current.fitToCoordinates(
//         [
//           {
//             latitude: dasherLocation.latitude,
//             longitude: dasherLocation.longitude,
//           },
//           {
//             latitude: customerLocation.latitude,
//             longitude: customerLocation.longitude,
//           },
//         ],
//         {
//           edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
//           animated: true,
//         }
//       );
//     }
//   }, [dasherLocation, customerLocation]);

//   // Open Google Maps for navigation
//   const openGoogleMapsNavigation = () => {
//     if (customerLocation) {
//       const url = `https://www.google.com/maps/dir/?api=1&destination=${customerLocation.latitude},${customerLocation.longitude}`;
//       Linking.openURL(url).catch(err => {
//         Alert.alert('Error', 'Could not open Google Maps');
//       });
//     }
//   };

//   if (loading) {
//     return (
//       <View style={styles.loadingContainer}>
//         <ActivityIndicator size="large" color="#BC4A4D" />
//         <Text style={styles.loadingText}>Loading map...</Text>
//       </View>
//     );
//   }

//   if (error) {
//     return (
//       <View style={styles.errorContainer}>
//         <Text style={styles.errorText}>{error}</Text>
//       </View>
//     );
//   }

//   return (
//     <View style={styles.container}>
//       {(dasherLocation || customerLocation) ? (
//         <MapView
//           ref={mapRef}
//           provider={PROVIDER_GOOGLE}
//           style={styles.map}
//           initialRegion={dasherLocation || customerLocation}
//         >
//           {dasherLocation && (
//             <Marker
//               coordinate={{
//                 latitude: dasherLocation.latitude,
//                 longitude: dasherLocation.longitude,
//               }}
//               title="You are here"
//               pinColor="#BC4A4D"
//             />
//           )}

//           {customerLocation && (
//             <Marker
//               coordinate={{
//                 latitude: customerLocation.latitude,
//                 longitude: customerLocation.longitude,
//               }}
//               title="Customer"
//               description={order?.deliverTo || "Delivery Location"}
//               pinColor="#4A7ABC"
//             />
//           )}

//           {/* Static marker at specified location */}
//           <Marker
//             coordinate={{
//               latitude: 10.2944327,
//               longitude: 123.8812167,
//             }}
//             title="Static Location"
//             description="Fixed location marker"
//             pinColor="blue"
//           />

//           {routePath.length > 0 && (
//             <Polyline
//               coordinates={routePath}
//               strokeWidth={4}
//               strokeColor="#BC4A4D"
//             />
//           )}
//         </MapView>
//       ) : (
//         <View style={styles.noLocationContainer}>
//           <Text style={styles.noLocationText}>
//             Waiting for location data...
//           </Text>
//         </View>
//       )}

//       <View style={styles.deliveryInfoContainer}>
//         <Text style={styles.deliveryTitle}>
//           Delivery to {order?.name || "Customer"}
//         </Text>
//         <Text style={styles.deliveryAddress}>{order?.deliverTo || "Loading address..."}</Text>
//         <Text style={styles.deliveryContact}>{order?.mobileNum ? `+63 ${order.mobileNum}` : ""}</Text>
//       </View>

//       <TouchableOpacity 
//         style={styles.navigationButton} 
//         onPress={openGoogleMapsNavigation}
//       >
//         <Text style={styles.navigationButtonText}>Navigate in Google Maps</Text>
//       </TouchableOpacity>
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },
//   map: {
//     flex: 1,
//   },
//   loadingContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: '#f8f9fa',
//   },
//   loadingText: {
//     marginTop: 10,
//     fontSize: 16,
//     color: '#333',
//   },
//   errorContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: '#f8f9fa',
//     padding: 20,
//   },
//   errorText: {
//     color: '#BC4A4D',
//     fontSize: 16,
//     textAlign: 'center',
//   },
//   noLocationContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: '#f8f9fa',
//   },
//   noLocationText: {
//     fontSize: 16,
//     color: '#666',
//   },
//   deliveryInfoContainer: {
//     backgroundColor: 'white',
//     padding: 15,
//     borderTopLeftRadius: 15,
//     borderTopRightRadius: 15,
//     shadowColor: '#000',
//     shadowOffset: {
//       width: 0,
//       height: -3,
//     },
//     shadowOpacity: 0.1,
//     shadowRadius: 3,
//     elevation: 5,
//   },
//   deliveryTitle: {
//     fontSize: 18,
//     fontWeight: 'bold',
//     marginBottom: 5,
//   },
//   deliveryAddress: {
//     fontSize: 16,
//     color: '#333',
//     marginBottom: 5,
//   },
//   deliveryContact: {
//     fontSize: 16,
//     color: '#007BFF',
//   },
//   navigationButton: {
//     backgroundColor: '#BC4A4D',
//     padding: 15,
//     alignItems: 'center',
//   },
//   navigationButtonText: {
//     color: 'white',
//     fontSize: 16,
//     fontWeight: 'bold',
//   },
// });

// export default DasherMap;