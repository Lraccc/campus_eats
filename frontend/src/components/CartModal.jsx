import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useCallback, useEffect, useState } from "react";
import { Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useOrderContext } from "../context/OrderContext";
import { useAuth } from "../utils/AuthContext";
import axios from '../utils/axiosConfig';
import AlertModal from './AlertModal';
import "./css/CartModal.css";

const CartModal = ({ showModal, onClose }) => {
    const { currentUser } = useAuth();
    const [cartData, setCartData] = useState(null);
    const [shopData, setShopData] = useState(null);
    const { cartData: contextCartData, fetchData } = useOrderContext();
    const navigate = useNavigate();

    const [alertModal, setAlertModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        showConfirmButton: true,
    });

    const handleProceed = () => {
        handleProceedToCheckout();
        onClose();
    };

    const fetchCartData = useCallback(async () => {
        try {
            const response = await axios.get(`/carts/cart`, {
                params: { uid: currentUser.id }
            });
            setCartData(response.data);
        } catch (error) {
            console.error('Error fetching cart data:', error);
        }
    }, [currentUser]);

    useEffect(() => {
        if (showModal && currentUser) {
            fetchCartData();
        }
    }, [showModal, currentUser, fetchCartData, contextCartData]);

    useEffect(() => {
        const fetchShopData = async () => {
            if (cartData && cartData.id) {
                try {
                    const response = await axios.get(`/shops/${cartData.shopId}`);
                    setShopData(response.data);
                } catch (error) {
                    console.error('Error fetching shop data:', error);
                }
            }
        };
        fetchShopData();
    }, [cartData]);

    const updateCartItem = async (itemId, action) => {
        try {
            const response = await axios.post('/carts/update-cart-item', {
                uid: currentUser.id,
                itemId,
                action
            });
            setCartData(response.data.cartData);
            fetchData();
            fetchCartData();
        } catch (error) {
            if (error.response && error.response.status === 400) {
                setAlertModal({
                    isOpen: true,
                    title: 'Error',
                    message: 'Quantity limit reached',
                    showConfirmButton: false,
                });
            } else {
                console.error(error.response);
            }
        }
    };

    const handleItemIncrease = (item) => {
        updateCartItem(item.itemId, 'increase');
    };

    const handleItemDecrease = (item) => {
        updateCartItem(item.itemId, 'decrease');
    };

    const handleItemRemove = (item) => {
        setAlertModal({
            isOpen: true,
            title: "Confirm to Remove",
            message: `Are you sure you want to remove ${item.name} from your cart?`,
            onConfirm: () => updateCartItem(item.itemId, 'remove'),
            showConfirmButton: true,
        });
    };

    const handleShopRemove = async () => {
        setAlertModal({
            isOpen: true,
            title: "Confirm to Remove Shop",
            message: `Are you sure you want to remove ${shopData.name}? This will remove all items in your cart.`,
            onConfirm: async () => {
                try {
                    const response = await axios.delete('/carts/remove-cart', {
                        data: { uid: currentUser.id }
                    });
                    setCartData(null);
                    fetchData();
                    fetchCartData();
                    setAlertModal({
                        isOpen: true,
                        title: 'Success',
                        message: response.data.message,
                        showConfirmButton: false,
                    });
                    
                    setTimeout(() => {
                        setAlertModal((prev) => ({ ...prev, isOpen: false }));
                    }, 3000);
                } catch (error) {
                    console.error('Error removing cart:', error);
                }
            },
            showConfirmButton: true,
        });
    };

    const handleProceedToCheckout = () => {
        navigate(`/checkout/${currentUser.id}/${cartData.shopId}`);
    };

    return (
        <>
        <AlertModal
                isOpen={alertModal.isOpen}
                closeModal={() => setAlertModal({ ...alertModal, isOpen: false })}
                title={alertModal.title}
                message={alertModal.message}
                onConfirm={alertModal.onConfirm}
                showConfirmButton={alertModal.showConfirmButton}
            />
        <div className={`cart-modal ${showModal ? 'show' : ''}`}>
            <div className="cm-modal">
                <div className="cm-modal-divider">
                    <div className="cm-modal-header">
                        {!cartData || cartData.items.length === 0 ? (
                            <h3 className="cm-modal-title">Your cart is empty...</h3>
                        ) : (
                            <>
                                <div className="cm-items">
                                    <div className="cm-store-item">
                                        <div className="cm-item-left">
                                            <img src={'/Assets/store-location-icon.png'} alt="store loc" className="cm-image-store" />
                                            <div className="cm-store-title">
                                                <h4>{shopData ? shopData.name : 'Store Name'}</h4>
                                                <p>{shopData ? shopData.address : 'Store Address'}</p>
                                            </div>
                                        </div>
                                        <div className="cm-item-right">
                                            <div className="cm-store-button">
                                                <Button className="cm-store-btn" onClick={handleShopRemove}>Remove</Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <h3 className="cm-modal-title">Your Items</h3>
                            </>
                        )}
                    </div>

                    <div className="cm-modal-body">
                        <div className="cm-items">
                            {cartData && cartData.items.map(item => (
                                <div className="cm-item" key={item.id}>
                                    <div className="cm-item-left">
                                        <div className="cm-item-buttons">
                                            <button className="cm-button" onClick={() => item.quantity > 1 ? handleItemDecrease(item) : handleItemRemove(item)}>
                                                {item.quantity > 1 ? <FontAwesomeIcon icon={faMinus} /> : <img src={'/Assets/remove-icon.png'} alt="remove" className="cm-image-remove" />}
                                            </button>
                                            <span className="cm-item-count">{item.quantity}</span>
                                            <button className="cm-button" onClick={() => handleItemIncrease(item)}>
                                                <FontAwesomeIcon icon={faPlus} />
                                            </button>
                                        </div>
                                        <div className="cm-item-title">
                                            <h4>{item.name}</h4>
                                            <p>More Description</p>
                                        </div>
                                    </div>
                                    <div className="cm-item-right">
                                        <p>₱{item.price}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="cm-modal-footer">
                    <div className="cm-subtotal">
                        <h5>Subtotal</h5>
                        <h4>₱{cartData ? cartData.totalPrice : '0.00'}</h4>
                    </div>
                    <div className="cm-subtotal">
                        <h5>Delivery Fee</h5>
                        <h4>₱{shopData ? shopData.deliveryFee : '0.00'}</h4>
                    </div>
                    <div className="cm-total">
                        <h5>Total</h5>
                        <h4>₱{cartData && shopData ? (cartData.totalPrice + shopData.deliveryFee).toFixed(2) : '0.00'}</h4>
                    </div>
                    <button
                        disabled={!cartData || cartData.items.length === 0}
                        className="cm-proceed-button"
                        onClick={handleProceed}
                    >
                        Proceed to Checkout
                    </button>
                </div>
            </div>
        </div>
        </>
    );
}

export default CartModal;
