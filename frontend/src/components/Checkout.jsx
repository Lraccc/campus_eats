import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";
import axios from '../utils/axiosConfig'; // Import your axiosConfig
import AlertModal from './AlertModal';
import "./css/Checkout.css";
const Checkout = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const { uid, shopId } = useParams();
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [mobileNum, setMobileNum] = useState("");
    const [deliverTo, setDeliverTo] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [changeFor, setChangeFor] = useState("");
    const [note, setNote] = useState("");
    const [cart, setCart] = useState(null);
    const [shop, setShop] = useState(null);
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [loading, setLoading] = useState(false);
    const [waitingForPayment, setWaitingForPayment] = useState(false);
    let pollInterval;
    
    const [alertModal, setAlertModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        showConfirmButton: true,
    });

    useEffect(() => {
         setFirstName(currentUser.firstname || "");
        setLastName(currentUser.lastname || "");
        setMobileNum(currentUser.phone ? currentUser.phone.replace(/^0/, '') : "");
    }, [currentUser]);

    useEffect(() => {
        setLoading(true);
     

        const fetchCartData = async () => {
            try {
                const response = await axios.get(`/carts/cart?uid=${uid}`);
                setCart(response.data);
                console.log("Cart data:", response.data);
            } catch (error) {
                console.error("Error fetching cart data:", error);
            }
        };
        fetchCartData();
        setLoading(false);
    }, []);

    if(!currentUser){
        navigate('/login');
    }

    // if(!shop){
    //     return <>Loading...</>
    // }
    const handleMouseEnter = (e) => {
        setShowTooltip(true);
        setTooltipPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseLeave = () => {
        setShowTooltip(false);
    };

    useEffect(() => {
        setLoading(true);
        const fetchShopData = async () => {
            if (shopId) {
                try {
                    const response = await axios.get(`/shops/${shopId}`);
                    setShop(response.data);
                    console.log("Shop data:", response.data);
                } catch (error) {
                    console.error('Error fetching shop data:', error);
                }
            }
        };

        fetchShopData();
        setLoading(false);
    }, [cart]);

    const changeWaitingForPayment = () => {
        setWaitingForPayment(false);
    }

    const pollPaymentStatus = async (linkId, refNum) => {
        const options = {
            method: 'GET',
            url: `https://api.paymongo.com/v1/links/${linkId}`,
            headers: {
                accept: 'application/json',
                authorization: 'Basic c2tfdGVzdF83SGdhSHFBWThORktEaEVHZ2oxTURxMzU6'
            }
        };

        try {
            const response = await axios.request(options);
            const paymentStatus = response.data.data.attributes.status;
            if (paymentStatus === 'paid') {
                setWaitingForPayment(false);
                handleOrderSubmission(refNum);
                
            }
        } catch (error) {
            console.error("Error checking payment status:", error);
        }
    };

    const checkDasherStatus = async () => {
        try{
            const response = await axios.get('/dashers');
            const availableDashers = response.data.filter(dasher => dasher.status === 'active');
            console.log("Available dashers:", availableDashers);
            return availableDashers.length > 0;
        }catch(error){
            console.error('Error fetching available dashers:', error);
    }
}

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        

        if (mobileNum.length !== 10 && mobileNum.startsWith('9')) {
            setAlertModal({
                isOpen: true,
                title: 'Invalid Mobile Number',
                message: ` Please enter a valid mobile number:  ${mobileNum}`,
                showConfirmButton: false,
            });
            setLoading(false);
            return;
        }

        if (paymentMethod === "cash") {
            if (changeFor < cart.totalPrice) {
                setAlertModal({
                    isOpen: true,
                    title: 'Invalid Amount',
                    message: 'Change for must be greater than or equal to the total price',
                    showConfirmButton: false,
                });
                setLoading(false);
                return;
            } else {
                handleOrderSubmission();
            }
        } else if (paymentMethod === "gcash") {
            try {
                console.log("total price:", cart.totalPrice );
                console.log("delivery fee:", shop.deliveryFee);
                const response = await axios.post("/payments/create-gcash-payment", {
                    amount: (cart.totalPrice + shop.deliveryFee), // PayMongo expects the amount in cents
                    description: `to ${shop.name} payment by ${firstName} ${lastName}`,
                    orderId: currentUser.id,
                });

                const data = response.data;
                console.log("GCash payment data:", data);
                window.open(data.checkout_url, "_blank");
                setWaitingForPayment(true);
                setLoading(false);

                pollInterval = setInterval(() => {
                    pollPaymentStatus(data.id, data.reference_number);
                }, 10000);

                return () => clearInterval(pollInterval);
            } catch (error) {
                console.error("Error creating GCash payment:", error);
                setLoading(false);
                setAlertModal({
                    isOpen: true,
                    title: 'Error',
                    message: `Error creating GCash payment: ${error.response?.data?.error || 'An unknown error occurred.'}`,
                    showConfirmButton: false,
                });
                return;
            }
        }
    };

    if (!cart || !shop) {
        return <div>Fetching...</div>; // Show a loading state while fetching data
    }
    // will test soon
    // const checkOfflineDashers = async () => {
    //     try {
    //         const response = await axios.get('/dashers');
    //         const availableDashers = response.data.filter(dasher => dasher.status === 'offline' || dasher.status === 'declined');
    //         console.log("Available dashers:", availableDashers);
    //         return availableDashers;
    //     } catch (error) {
    //         console.error('Error fetching available dashers:', error);
    //     }
    // }

    const showConfirmation = async (message) => {
        return new Promise((resolve) => {
            setAlertModal({
                isOpen: true,
                title: 'No Dashers Available',
                message,
                onConfirm: () => {
                    setAlertModal({ ...alertModal, isOpen: false });
                    resolve(true);
                },
                showConfirmButton: true,
            });
        });
    };
    
    const handleOrderSubmission = async (refNum) => {
        console.log("Submitting order... refnum : ", refNum);
        const activeDashers = await checkDasherStatus();
        if (!activeDashers) {
            setLoading(false);
            const proceed = await showConfirmation('There are no active dashers available at the moment. Do you want to continue finding?');
            if (!proceed) {
                return;
            }
            setLoading(true);
        }
        const order = {
            uid: currentUser.id,
            shopId: cart.shopId,
            firstname: firstName,
            lastname: lastName,
            mobileNum,
            deliverTo,
            paymentMethod,
            note,
            deliveryFee: shop.deliveryFee,
            items: cart.items,
            totalPrice: cart.totalPrice,
            refNum,
        };
    
        if (paymentMethod === "cash" && changeFor) {
            order.changeFor = changeFor;
        }

        if(paymentMethod === 'gcash'){
                await axios.put(`/shops/update/${shop.id}/wallet`, null, { params: { totalPrice: cart.totalPrice } });
            }
    
        console.log("Order:", order);
    
        try {
            const response = await axios.post("/orders/place-order", order);
    
            try {
                const removeCartResponse = await axios.delete('/carts/remove-cart', {
                    data: { uid: currentUser.id }
                });
                console.log("Cart removed:", removeCartResponse.data);
                console.log("Order placed:", response.data);
                setCart(null);
                clearInterval(pollInterval);
            } catch (error) {
                console.error('Error removing cart:', error);
            }

            
            navigate(`/orders`)
            
        } catch (error) {
            setAlertModal({
                isOpen: true,
                title: 'Existing active order',
                message: error.response?.data?.error,
                showConfirmButton: false,
            });
            setLoading(false);
            return;
        }
    
        setLoading(false);
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
            <div className="co-body">
                <div className="co-content-current">
                    <div className="co-card-current co-card-large">
                        <div className="co-text">
                            <h2 className="font-semibold">Contact Details</h2>
                            <form onSubmit={handleSubmit} className="co-form">
                                <div className="sa-two">
                                    <div className="sa-field-two">
                                        <div className="sa-label-two">
                                            <h3>Firstname</h3>
                                            <input
                                                type="text"
                                                className="first-name"
                                                value={firstName}
                                                onChange={(e) => setFirstName(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="sa-field-two">
                                        <div className="sa-label-two">
                                            <h3>Lastname</h3>
                                            <input
                                                type="text"
                                                className="last-name"
                                                value={lastName}
                                                onChange={(e) => setLastName(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="co-field-two">
                                    <div className="sa-label-two">
                                        <h3>Mobile Number</h3>
                                        <div className="gcash-input-container">
                                            <span className="gcash-prefix">+63 </span>
                                            <input
                                                type="text"
                                                className="gcash-num"
                                                value={mobileNum}
                                                onChange={(e) => setMobileNum(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                    
                                </div>
                                <div className="sa-two">
                                    <div className="sa-field-two i-field-desc">
                                        <div className="sa-label-two">
                                            
                                            <div className="tooltip-container">
                                                <h3>
                                                    Deliver To
                                                    <FontAwesomeIcon
                                                        icon={faInfoCircle}
                                                        className="info-icon"
                                                        onMouseEnter={handleMouseEnter}
                                                        onMouseLeave={handleMouseLeave}
                                                    />
                                                    
                                                </h3>
                                                {showTooltip && (
                                                    <div className={`tooltip ${showTooltip ? 'beside' : ''}`} style={{ top: tooltipPosition.y, left: tooltipPosition.x }}>
                                                        Example: RTL Building, Room 101
                                                    </div>
                                                )}
                                
                                            </div>
                                            

                                            
                                            <div className="gcash-input-container">
                                                <input
                                                    type="text"
                                                    className="deliver-to"
                                                    value={deliverTo}
                                                    onChange={(e) => setDeliverTo(e.target.value)}
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="sa-field-two i-field-desc">
                                        <div className="co-label-two">
                                            <h3>Delivery Note</h3>
                                            <textarea
                                                className="note"
                                                value={note}
                                                onChange={(e) => setNote(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="payment-method">
                                    <h2 className="font-semibold">Payment Method</h2>
                                    {shop && shop.acceptGCASH === false? (
                                            <>
                                            <p>This shop doesn't accept online payment</p>
                                            </>
                                            ) : (
                                                <></>
                                            )}
                                    <div className="payment-options">
                                        <label className={`payment-option ${paymentMethod === 'cash' ? 'selected' : ''}`}>
                                            <input
                                                type="radio"
                                                name="paymentMethod"
                                                value="cash"
                                                checked={paymentMethod === "cash"}
                                                onChange={() => setPaymentMethod("cash")}
                                            />
                                            <div className="payment-card">
                                                Cash on Delivery
                                                {paymentMethod === "cash" && (
                                                    <div className="change-for-input">
                                                        <label>Change for:</label>
                                                        <input
                                                            type="number"
                                                            value={changeFor}
                                                            onChange={(e) => setChangeFor(e.target.value)}
                                                            required
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </label>
                                        
                                        {cart && shop && ((cart.totalPrice + shop.deliveryFee) >100) && shop.acceptGCASH === true ? (
                                        <label className={`payment-option ${paymentMethod === 'gcash' ? 'selected' : ''}`}>
                                            <input
                                                type="radio"
                                                name="paymentMethod"
                                                value="gcash"
                                                checked={paymentMethod === "gcash"}
                                                onChange={() => setPaymentMethod("gcash")}
                                            />
                                            <div className="payment-card">
                                                Online Payment
                                            </div>
                                        </label>
                                        ): (
                                            <></>
                                            )}
                                    </div>
                                </div>
                                <div className="p-buttons">
                                    {!waitingForPayment && (
                                    <button onClick={()=>navigate('/home')} className="p-logout-button">Cancel</button>
                                    )}
                                   {waitingForPayment && <button type="submit" className="p-logout-button" onClick={()=> changeWaitingForPayment()}>
                                        Cancel Online Payment
                                    </button>}
                                    <button type="submit" className="p-save-button" disabled={loading || waitingForPayment}>
                                        {waitingForPayment ? "Waiting for Payment" : "Place Order"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                    <div className="co-card-current co-card-small">
                    {cart ? (
                            <>
                            <div className="co-order-summary">
                                <h3 className="font-semibold">Your order from</h3>
                                <div className="co-order-text">
                                        <h4>{shop ? shop.shopName: ''}</h4>
                                        <p>{shop ? shop.shopAddress: ''}</p>
                                </div>
                                {cart.items.map((item, index) => (
                                    <div className="co-order-summary-item" key={index}>
                                        <div className="co-order-summary-item-header">
                                            <p>{item.quantity}x</p>
                                            <p>{item.name}</p>
                                        </div>
                                        <p>₱{item.price.toFixed(2)}</p>
                                    </div>
                                ))}
                                <div className="co-order-summary-total-container">
                                    <div className="co-order-summary-subtotal">
                                        <h4 className="font-semibold">Subtotal</h4>
                                        <h4>₱{cart.totalPrice.toFixed(2)}</h4>
                                    </div>
                                    <div className="co-order-summary-subtotal">
                                        <h4 className="font-semibold">Delivery Fee</h4>
                                        
                                        <h4>₱{shop.deliveryFee ? shop.deliveryFee.toFixed(2) : '0.00'}</h4>
                                    </div>
                                    <div className="co-order-summary-total">
                                        <h4 className="font-semibold">Total</h4>
                                        <h4 className="font-semibold">₱{(cart.totalPrice + (shop.deliveryFee ? shop.deliveryFee : 0)).toFixed(2)}</h4>
                                    </div>
                                </div>
                            </div>
                            </>
                        ) : (
                            <div className="co-order-summary">
                            <p>Loading order summary...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default Checkout;
