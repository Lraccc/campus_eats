import { useEffect } from "react";
import { useOrderContext } from "../../context/OrderContext";

const CartItemCount = ({ showModal, setShowModal, disabled }) => {
  const { cartQuantity } = useOrderContext();

  useEffect(() => {
    console.log("Cart quantity updated: " + cartQuantity);
  }, [cartQuantity]);

  return (
    <div className={`nb-cart ${disabled ? '' : 'disabled'}`} onClick={() => setShowModal(!showModal)}>
      <div className="nb-cart-icon">
        <img src={"/Assets/cart.png"} alt="Cart" className="nb-image-cart" />
      </div>
      {cartQuantity > 0 && 
        <div className="nb-cart-count">
          <span>{cartQuantity}</span>
        </div>
      }
    </div>
  );
};

export default CartItemCount;