import React, { createContext, useContext, useState, useEffect } from "react";
// import { useNavigate } from "react-router-dom";
import api from "../utils/axiosConfig";
import { useAuth } from "../utils/AuthContext";
import AlertModal from "../components/AlertModal";
const OrderContext = createContext();

const fetchCartData = async (currentUser) => {
  try {
    const { data } = await api.get(`/carts/cart?uid=${currentUser.id}`);
    // Directly access response.data with axios

    if(!Array.isArray(data)) {
      return [data];
    }

    if(data.length > 0 ) {
      return data
    }

    return [];
  } catch (error) {
    console.error("Error fetching cart data:", error);
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

    setCartData(data);
    setCartQuantity(data.length)
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
        // Check if the cart already has items from a different shop
        const existingCart = await fetchCartData(currentUser);
        if (existingCart && existingCart.length > 0) {
          const cart = existingCart[0]; // Assuming the cart data structure
          const existingShopId = cart.shopId;
  
          if (existingShopId && existingShopId !== item.shopId) {
            setAlertModal({
              isOpen: true,
              title: 'Error',
              message: "You cannot add items from a different shop. Please remove your previous items first.",
              showConfirmButton: false,
            });
            return; // Early exit
          }
        }
  
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
