const API_ROOT = (process.env.REACT_APP_API_BASE || "https://campus-eats-backend.onrender.com").replace(/\/$/, "");
const API_BASE = `${API_ROOT}/api/orders`;

// POST user location
export const updateUserLocationOnServer = async (orderId, locationData) => {
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(orderId)}/location/user`, {
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
    const res = await fetch(`${API_BASE}/${encodeURIComponent(orderId)}/location/dasher`, {
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
    const res = await fetch(`${API_BASE}/${encodeURIComponent(orderId)}/location/user`);
    if (res.status === 404 || res.status === 204) return null;
    if (!res.ok) throw new Error("Failed to fetch user location");
    return await res.json();
  } catch (err) {
    console.error("Error fetching user location:", err);
    return null;
  }
};

// GET dasher location
export const getDasherLocationFromServer = async (orderId) => {
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(orderId)}/location/dasher`);
    if (res.status === 404 || res.status === 204) return null;
    if (!res.ok) throw new Error("Failed to fetch dasher location");
    return await res.json();
  } catch (err) {
    console.error("Error fetching dasher location:", err);
    return null;
  }
};