import React, { createContext, useContext, useState, useEffect } from "react";
// import { useNavigate } from "react-router-dom";
import api from "../utils/axiosConfig";
import { useAuth } from "../utils/AuthContext";
import AlertModal from "../components/AlertModal";
const OrderContext = createContext();

const fetchCartData = async (currentUser) => {
  try {
    const { data } = await api.get(`/carts/cart?uid=${currentUser.id}`);

    // normalize various backend shapes into an array of shop-level carts
    // possible responses:
    // - CartEntity { id, shops: [ { shopId, items, totalPrice }, ... ] }
    // - single ShopCart { shopId, items, totalPrice }
    // - array of ShopCart
    if (!data) return [];

    if (Array.isArray(data)) {
      // array could already be ShopCart[] or CartEntity[]; try to detect
      if (data.length === 0) return [];
      if (data[0].shopId) return data; // already ShopCart[]
      if (data[0].shops && Array.isArray(data[0].shops)) {
        // flatten shops from CartEntity[]
        return data.flatMap(d => d.shops || []);
      }
      return data;
    }

    // object case
    if (data.shops && Array.isArray(data.shops)) {
      return data.shops; // CartEntity -> return shops array
    }

    if (data.shopId && data.items && Array.isArray(data.items)) {
      return [data]; // single ShopCart
    }

    return [];
  } catch (error) {
    console.error("Error fetching cart data:", error);
    return [];
  }
};

export function OrderProvider({ children }) {
  const { currentUser } = useAuth();
  const [cartData, setCartData] = useState([]);
  const [cartQuantity, setCartQuantity] = useState(0);

  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    showConfirmButton: false,
  });

  const fetchData = async () => {
    const data = await fetchCartData(currentUser);

    if(!data) {
      setCartData([]);
      setCartQuantity(0);

      return
    }

    // store full cart data (array of carts)
    setCartData(data);

    // compute total item quantity across all carts
    const totalQuantity = data.reduce((totalCarts, cart) => {
      const cartItemsTotal = (cart.items || []).reduce((t, it) => t + (it.quantity || 0), 0);
      return totalCarts + cartItemsTotal;
    }, 0);

    setCartQuantity(totalQuantity);
  }

  useEffect(() => {
    if (!currentUser) {
      return;
    }        

    fetchData();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const addToCart = async ({ item, userQuantity, totalPrice }) => {
    if (userQuantity > 0) {
      try {
        // Allow adding items from other shops. Backend supports separate carts per shop.
        const response = await api.post("/carts/add-to-cart", {
          item: {
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            userQuantity,
          },
          totalPrice,
          uid: currentUser.id,
          shopId: item.shopId,
        });
  
        if (response.status !== 200) {
          throw new Error(response.data.error || "Failed to add item to cart");
        }
  
        // Fetch updated cart data
        const data = await fetchCartData(currentUser);
  
        if (data) {
          setCartData(data);
  
          // Calculate total quantity from cart data
          const totalQuantity = data.reduce((total, cart) => {
            return total + (cart.items.reduce((itemTotal, item) => itemTotal + item.quantity, 0)); // Total quantity from CartItem
          }, 0);
  
          setCartQuantity(totalQuantity);
        } else {
          setCartData([]);
          setCartQuantity(0);
        }
      } catch (error) {
        console.error("Error adding item to cart:", error);
        setAlertModal({
          isOpen: true,
          title: 'Error',
          message: error.message || "An error occurred while adding item to cart.",
          showConfirmButton: false,
        });
      }
    }
  };
  
  

  return (
    <OrderContext.Provider
      value={{
        cartData,
        cartQuantity,
        addToCart,
        setCartData,
        fetchData
      }}
    >
      {children}
      <AlertModal
        isOpen={alertModal.isOpen}
        closeModal={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        showConfirmButton={alertModal.showConfirmButton}
      />
    </OrderContext.Provider>
  );
}

export function useOrderContext() {
  return useContext(OrderContext);
}
