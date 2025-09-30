const API_BASE = "http://localhost:8080/api/orders";

// POST user location
export const updateUserLocationOnServer = async (orderId, locationData) => {
  try {
    const res = await fetch(`${API_BASE}/${orderId}/location/user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(locationData),
    });
    if (!res.ok) throw new Error("Failed to update user location");
    return await res.json();
  } catch (err) {
    console.error("Error updating user location:", err);
    throw err;
  }
};

// POST dasher location
export const updateDasherLocationOnServer = async (orderId, locationData) => {
  try {
    const res = await fetch(`${API_BASE}/${orderId}/location/dasher`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(locationData),
    });
    if (!res.ok) throw new Error("Failed to update dasher location");
    return await res.json();
  } catch (err) {
    console.error("Error updating dasher location:", err);
    throw err;
  }
};

// GET user location
export const getUserLocationFromServer = async (orderId) => {
  try {
    const res = await fetch(`${API_BASE}/${orderId}/location/user`);
    if (!res.ok) throw new Error("Failed to fetch user location");
    return await res.json();
  } catch (err) {
    console.error("Error fetching user location:", err);
    throw err;
  }
};

// GET dasher location
export const getDasherLocationFromServer = async (orderId) => {
  try {
    const res = await fetch(`${API_BASE}/${orderId}/location/dasher`);
    if (!res.ok) throw new Error("Failed to fetch dasher location");
    return await res.json();
  } catch (err) {
    console.error("Error fetching dasher location:", err);
    throw err;
  }
};