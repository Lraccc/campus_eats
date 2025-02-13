import React, { useContext, useEffect, useState } from "react";
import { toast } from 'sonner';
import { AuthContext, useAuth, } from "../utils/AuthContext";
import axios from "../utils/axiosConfig";
import CancelOrderModal from "./CancelOrderModal";
import "./css/Order.css";
import RefundOrderModal from "./RefundOrderModal";
import ReviewModal from './ReviewModal'; // Adjust the path as needed
import ReviewShopModal from './ReviewShopModal'; // Import the ReviewShopModal
import UserNoShowModal from './UserNoShowModal';
import OrderEditPhoneNumModal from './OrderEditPhoneNumModal';
import ShopCancelModal from './UserShopCancelModal';

const Order = () => {
    const { currentUser } = useAuth();
    const [activeOrder, setActiveOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [shop, setShop] = useState(null);
    const [orders, setOrders] = useState([]);
    const [status, setStatus] = useState(null);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [isReviewShopModalOpen, setIsReviewShopModalOpen] = useState(false); // State for ReviewShopModal
    const [selectedOrder, setSelectedOrder] = useState(null); // State for the selected order
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
    const [isEditPhoneNumModalOpen, setIsEditPhoneNumModalOpen] = useState(false);
    const [dasherName, setDasherName] = useState(''); // State for dasher name
    const [dasherPhone, setDasherPhone] = useState(''); // State for dasher phone
    const [isNoShowModalOpen, setIsNoShowModalOpen] = useState(false);
    const [isShopCancelModalOpen, setIsShopCancelModalOpen] = useState(false);
    const [pollingInterval, setPollingInterval] = useState(null);
    const [offenses, setOffenses] = useState(null);
    const { logout } = useContext(AuthContext);



    const fetchOffenses = async () => {
        setIsLoading(true);
        try {
        const response = await axios.get(`users/${currentUser.id}/offenses`);
        const data = response.data;
        setOffenses(data);

        }catch (error) {
    }finally {
        setIsLoading(false);
    }
}


 const postOffenses = async () => {
    if (activeOrder && activeOrder.dasherId !== null) {
        try {
            const response = await axios.post(`/users/${currentUser.id}/offenses`);
            if (response.status !== 200) {
                throw new Error("Failed to post offenses");
            }
            console.log(response.data);
            setOffenses(response.data);
        } catch (error) {
            console.error("Error posting offenses:", error);
        }
    }
};
 


useEffect(() => {
    console.log(offenses);
    console.log(typeof offenses)
        if (offenses >= 3) {
            logout(); 
        }
    }, [offenses]);



    const fetchOrders = async () => {
        try {
            const ordersResponse = await axios.get(`/orders/user/${currentUser.id}`);
            if (ordersResponse.status !== 200) {
                throw new Error("Failed to fetch orders");
            }

            const ordersData = ordersResponse.data;
            const activeOrder = ordersData.activeOrders.length > 0 ? ordersData.activeOrders[0] : null;
            setActiveOrder(activeOrder);

            if (activeOrder) {
                // Fetch dasher details if dasherId exists
                if (activeOrder.dasherId) {
                    const dasherResponse = await axios.get(`/dashers/${activeOrder.dasherId}`);
                    if (dasherResponse.status === 200) {
                        const dasherData = dasherResponse.data;
                        setDasherName(dasherData.gcashName); // Set dasher name
                        setDasherPhone(dasherData.gcashNumber); // Set dasher phone
                    }
                }
            }

            if (ordersData.activeOrders.length > 0) {
                switch (activeOrder.status) {
                    // case 'active_waiting_for_admin':
                    case 'active_waiting_for_dasher':
                        setStatus('Searching for Dashers. Hang tight, this might take a little time!');
                        break;
                    case 'active_shop_confirmed':
                        setStatus('Dasher is on the way to the shop.');
                        break;
                    case 'active_preparing':
                        setStatus('Order is being prepared');
                        break;
                    case 'active_onTheWay':
                        setStatus('Order is on the way');
                        break;
                    case 'active_delivered':
                        setStatus('Order has been delivered');
                        break;
                    case 'active_waiting_for_confirmation':
                        setStatus('Waiting for your confirmation');
                        setIsReviewModalOpen(true); // Open the modal
                        break;
                    case 'active_pickedUp':
                        setStatus('Order has been picked up');
                        break;
                    case 'active_toShop':
                        setStatus('Dasher is on the way to the shop');
                        break;
                    case 'cancelled_by_customer': 
                        setStatus('Order has been cancelled');
                        break;
                    case 'cancelled_by_dasher': 
                        setStatus('Order has been cancelled');
                        break;
                    case 'cancelled_by_shop': 
                        setStatus('Order has been cancelled');
                        break;
                    case 'active_waiting_for_shop': 
                        setStatus('Dasher is on the way to the shop');
                        break;
                    case 'refunded': 
                        setStatus('Order has been refunded');
                        break;
                    case 'active_waiting_for_cancel_confirmation': 
                        setStatus('Order is waiting for cancellation confirmation');
                        break;
                    case 'no-show': 
                        setStatus('Customer did not show up for the delivery');
                        break;
                    case 'active_waiting_for_no_show_confirmation': 
                        setStatus('Order failed: Customer did not show up for delivery');
                        break;
                    default:
                        setStatus('Unknown status');
                }
            }

            const ordersShopData = await Promise.all(
                ordersData.orders.map(async (order) => {
                    const ordersShopDataResponse = await axios.get(`/shops/${order.shopId}`);
                    const ordersShop = ordersShopDataResponse.data;
                    return { ...order, shopData: ordersShop }; 
                })
            );

            setOrders(ordersShopData);
            
        } catch (error) {
            console.error("Error fetching orders:", error);
        } finally {
            setLoading(false);
        }
    };

    // Setup SSE for notifications
    useEffect(() => {
        const eventSource = new EventSource('https://campuseats-production.up.railway.app/api/notifications/stream');
    
        eventSource.onmessage = (event) => {
          console.log('Received:', event.data);
    
          // Conditional toast notifications based on event.data
      if (event.data.includes("Your order has been assigned to")) {
        toast.info(event.data); // Show info toast for "assigned to (name)"
      } else {
        switch (event.data) {
          case "Dasher is on the way to the shop.":
          case "Order is being prepared.":
          case "Looking for a Dasher to be assigned.":
          case "Dasher is on the way to deliver your order.":
          case "Order has been cancelled.":
          case "Order is waiting for cancellation confirmation.":
          case "Order is waiting for confirmation.":
          case "Dasher is waiting for the shop to confirm the order.":
            toast.info(event.data); // Show info toast for these messages
            break;

          case "You did not show up for the delivery.":
          case "Order has been cancelled by the Dasher.":
          case "Order has been cancelled by the Shop.":
            toast.error(event.data); // Show error toast for these messages
            break;
          
          case "Order has been confirmed by the shop.":
          case "Order has been delivered.":
          case "Order has been picked up.":
          case "Order has been completed.":
            toast.success(event.data); // Show success toast for these messages
            break;

          default:
            toast.error(event.data); // Show a default toast for any other messages
            break;
        }
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource failed:', error);
      eventSource.close();
    };

    // Fetch orders when component mounts
    fetchOrders();
    fetchOffenses();

    // Cleanup SSE on component unmount
    return () => {
      eventSource.close();
    };
  }, []);

    const fetchShopData = async (id) => {
        try {
            const response = await axios.get(`/shops/${id}`);
            if (response.status !== 200) {
                throw new Error('Failed to fetch shop data');
            }
            const data = response.data;
            setShop(data);
        } catch (error) {
            console.error('Error fetching shop data:', error);
        }
    };

   const startPolling = () => {
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }

    if (activeOrder && activeOrder.shopId) {
        const intervalId = setInterval(async () => {
            await fetchOrders();
            if (activeOrder && activeOrder.shopId) {
                await fetchShopData(activeOrder.shopId);
                const orderStatusResponse = await axios.get(`/orders/${activeOrder.id}`);
                const orderStatus = orderStatusResponse.data.status;
                console.log(orderStatus);
                if (orderStatus === 'no-show') {
                    setIsNoShowModalOpen(true);
                    clearInterval(intervalId);
                }

                // Check for cancelled status
                if (orderStatus === 'cancelled_by_shop') {
                    setIsShopCancelModalOpen(true);
                    clearInterval(intervalId);
                }
            }
        }, 4000);
        setPollingInterval(intervalId);
    }
};

const checkDasherStatus = async () => {
    try{
        const response = await axios.get('/dashers')
        const dashers = response.data;
        const active = dashers.filter(dasher => dasher.status === 'active' || dasher.status === 'ongoing order');
        if(active.length === 0){
        toast.warning('There are no active dashers. Please try again later.');
        console.log(active)
        }
    }catch(error){
        console.error('Error checking dasher status:', error);
    }
}

useEffect(() => {
    // check if there is an active order, before starting the interval
    if(activeOrder){
    const dasherStatusInterval = setInterval(() => {
        checkDasherStatus();
    }, 4000); // Check dasher status every 10 seconds

    return () => {
        clearInterval(dasherStatusInterval);
    };
}
}, [activeOrder]);



    useEffect(() => {
        setIsLoading(true);
        if (activeOrder && activeOrder.shopId) {
            fetchShopData(activeOrder.shopId);
        }
        setIsLoading(false);
    }, [activeOrder]);

    useEffect(() => {
        startPolling();
        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
        };
    }, [currentUser, activeOrder]);

 const handleCancelOrderConfirmed = async () => {
        setIsLoading(true); 
        try {
            let newStatus = '';
            if (activeOrder.dasherId !== null) {
                newStatus = 'active_waiting_for_cancel_confirmation';
            } else {
                newStatus = 'cancelled_by_customer';
            }
            const updateResponse = await axios.post('/orders/update-order-status', {
                orderId: activeOrder.id,
                status: newStatus
            });

            if (updateResponse.status === 200) {
                await postOffenses();

            }

        } catch (error) {
            console.error('Error updating order status:', error);
        } finally {
            setIsLoading(false); 
        }
    };
     

    // Function to open the ReviewShopModal
    const handleOpenReviewShopModal = (order) => {
        setSelectedOrder(order);
        setIsReviewShopModalOpen(true);
    };

    
    const closeEditPhoneNumModal = () => {
        setIsEditPhoneNumModalOpen(false);
    };


    const handleCancelOrder = () => {
        setIsCancelModalOpen(true); 
    };
    const closeCancelModal = () => {
        setIsCancelModalOpen(false);
        setTimeout(() => {
            window.location.reload();
        }, 500); 
    };
    const handleRefundOrder = () => {
        setIsRefundModalOpen(true); 
    };
    const hideRefundButton = status === 'Order is being prepared'
        || status === 'Order has been picked up'
        || status === 'Order is on the way'  
        || status === 'Order has been delivered'  
        || status === 'Order has been completed'
        || status === 'Order is waiting for cancellation confirmation'
        || status === 'Waiting for your confirmation';
    const hideCancelButton = status === 'Order is being prepared'
        || status === 'Order has been picked up'
        || status === 'Order is on the way' 
        || status === 'Order has been delivered' 
        || status === 'Order has been completed'
        || status === 'Order is waiting for cancellation confirmation'
        || status === 'Waiting for your confirmation';

    const handleNoShowModalClose = () => {
        setIsNoShowModalOpen(false);
        setTimeout(() => {
            window.location.reload();
        }, 500);
    };

    const handleShopCancelModalClose = () => {
        setIsShopCancelModalOpen(false);
        setTimeout(() => {
            window.location.reload();
        }, 500);
    };

    const handleReviewModalClose = () => {
        setIsReviewModalOpen(false);
        setTimeout(() => {
            window.location.reload();
        }, 500);
    };
    
    return (
        <>
            
            <div className="o-body">
            {isReviewModalOpen && (
                <ReviewModal 
                    isOpen={isReviewModalOpen} 
                    order={activeOrder}
                    shop={shop}
                    onClose={handleReviewModalClose} 
                />
            )}
            {isReviewShopModalOpen && (
                <ReviewShopModal
                    isOpen={isReviewShopModalOpen}
                    order={selectedOrder}
                    shop={selectedOrder?.shopData}
                    onClose={() => setIsReviewShopModalOpen(false)}
                />
            )}
            {isCancelModalOpen && (
                <CancelOrderModal
                    isOpen={isCancelModalOpen}  
                    closeModal={closeCancelModal}  
                    shopData={shop} 
                    orderData={activeOrder} 
                    onCancelConfirmed={handleCancelOrderConfirmed}
                />
            )}
            {isRefundModalOpen && (
                <RefundOrderModal
                    isOpen={isRefundModalOpen}  
                    closeModal={() => setIsRefundModalOpen(false)}
                    orderData={activeOrder} 
                />
            )}
            {isNoShowModalOpen && ( // Render the No-Show Modal
                    <UserNoShowModal 
                        isOpen={isNoShowModalOpen}
                        closeModal={handleNoShowModalClose}
                    />
                )}
            {isShopCancelModalOpen && ( // Render the Shop Cancel Modal
                    <ShopCancelModal 
                        isOpen={isShopCancelModalOpen}
                        closeModal={handleShopCancelModalClose} 
                    />
                )}
            {isEditPhoneNumModalOpen && ( // Render the Edit Phone Number Modal
                    <OrderEditPhoneNumModal
                        isOpen={isEditPhoneNumModalOpen}
                        closeModal={closeEditPhoneNumModal} 
                        mobileNum={activeOrder.mobileNum}
                        orderId={activeOrder.id}
                    />
                )}
                <div className="o-title font-semibold">
                    <h2>Active Order</h2>
                </div>
                 {activeOrder ? (
                <div className="o-content-current">
                    <div className="o-card-current o-card-large">
                        <div className="o-text">
                            <h2>Order Details</h2>
                            <div className="o-order-content">
                                <div className="o-order-img-holder">
                                    <img src={shop ? shop.imageUrl : '/Assets/Panda.png'} alt="food" className="o-order-img"/>
                                </div>
                                <div className="o-order-details">
                                    <div className="o-order-text">
                                        <h3>{shop ? shop.name : ''}</h3>
                                        <p>{shop ? shop.address : ''}</p>
                                        <div className="o-order-subtext">
                                        <p>Dasher Name:</p>
                                        <h4>{dasherName ? dasherName : 'N/A'}</h4>
                                        <p>Dasher Phone:</p>
                                        <h4>
                                            {dasherPhone ? (
                                                <a 
                                                    href={`tel:+63${dasherPhone}`} // Adding +63 to the telephone link
                                                    style={{ 
                                                        textDecoration: 'underline', 
                                                        color: '#007BFF',
                                                        padding: '2px 4px',
                                                        borderRadius: '4px'
                                                    }}
                                                >
                                                    {`+63 ${dasherPhone}`} {/* Displaying +63 with the phone number */}
                                                </a>
                                            ) : (
                                                'N/A'
                                            )}
                                        </h4>
                                            <p>Delivery Location</p> 
                                            <h4>{activeOrder ? activeOrder.deliverTo : ''}</h4>
                                            <p>Order number</p> 
                                            <h4>#{activeOrder ? activeOrder.id : ''}</h4>
                                            <p>Payment Method</p> 
                                            <h4>{activeOrder ? activeOrder.paymentMethod : ''}</h4>
                                            <p>Phone number</p> 
                                            <h4>{activeOrder ? activeOrder.mobileNum : ''} <a 
                                                     // Adding +63 to the telephone link
                                                    style={{ 
                                                        textDecoration: 'underline', 
                                                        color: '#007BFF',
                                                        padding: '2px 4px',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer'
                                                    }}
                                                onClick={() => {setIsEditPhoneNumModalOpen(true)}}>
                                                    edit 
                                                </a></h4>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="o-order-summary">
                                <h3>Order Summary</h3>
                                {activeOrder.items.map((item, index) => (
                                    <div className="o-order-summary-item" key={index}>
                                        <div className="o-order-summary-item-header">
                                            <p>{item.quantity}x</p>
                                            <p>{item.name}</p>
                                        </div>
                                        <p>₱{item.price}</p>
                                    </div>
                                ))}
                                <div className="o-order-summary-total-container">
                                    <div className="o-order-summary-subtotal">
                                        <h4>Subtotal</h4>
                                        <h4>₱{activeOrder.totalPrice.toFixed(2)}</h4>
                                    </div>
                                    <div className="o-order-summary-subtotal">
                                        <h4>Delivery Fee</h4>
                                        <h4>₱{shop ? shop.deliveryFee.toFixed(2) : ''}</h4>
                                    </div>
                                    <div className="o-order-summary-total">
                                        <h4>Total</h4>
                                        <h4>
                                        ₱{activeOrder.totalPrice && shop ? (activeOrder.totalPrice + shop.deliveryFee).toFixed(2) : ''}
                                        </h4>
                                    </div>
                                </div>
                                {activeOrder && (
                                    <div className="refund-cancel-order-container">
                                        {activeOrder.paymentMethod === 'gcash' && !hideRefundButton && (
                                            <button className="refund-order-btn" onClick={handleRefundOrder}>
                                                Cancel and Refund
                                            </button>
                                        )}
                                        {activeOrder.paymentMethod === 'cash' && !hideCancelButton && (
                                            <button className="cancel-order-btn" onClick={handleCancelOrder}>
                                                {isLoading ? 'Cancelling...' : 'Cancel Order'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="o-card-current o-card-small">
                        <div className="o-text">
                            <div className="loader">
                                <div className="circle">
                                    <div className="dot"></div>
                                    <div className="outline"></div>
                                </div>
                                <div className="circle">
                                    <div className="dot"></div>
                                    <div className="outline"></div>
                                </div>
                                <div className="circle">
                                    <div className="dot"></div>
                                    <div className="outline"></div>
                                </div>
                                <div className="circle">
                                    <div className="dot"></div>
                                    <div className="outline"></div>
                                </div>
                            </div>
                            <div className="o-subtext-current">
                                <h4>{status ? status : ''}</h4>
                            </div>
                        </div>
                        <img src='/Assets/active-img.png' alt="food" className="o-left-current-img"/>
                    </div>
                </div>
                ) : (
                    <p>No active order found.</p>
                )}
                <div className="o-title flex w-[73%] justify-between">
                    <h2 className="font-semibold">Past Orders</h2> 
                    {isLoading ? (<div>Loading offenses...</div>): offenses > 0 ? (<div className="p-2 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
  <span className="font-medium">Warning!</span> x{offenses} {offenses > 1 ? "offenses": "offense"} recorded. 3 cancellations will lead to account ban.
</div>): <div></div>}
                </div>
                {loading ? (<div className="flex justify-center items-center h-[60vh] w-[80vh]">
                        <div
                            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>) : orders.length === 0 && <div className="j-no-orders">No past orders...</div>}
                <div className="o-content-past">
                    {orders.map((order, index) => (
                        <div 
                            className="o-card-past" 
                            key={index}
                            onClick={() => {
                                if(!order.status.includes('cancelled_') && !order.status.includes('no-') ? 'disabled' :'') {                                
                                handleOpenReviewShopModal(order)}}
                                } // Make the order clickable
                        >
                            <div className="o-past-img-holder">
                                <img src={order.shopData.imageUrl ? order.shopData.imageUrl : '/Assets/Panda.png'} alt="food" className="o-past-img"/>
                            </div>
                            <div className="o-past-details">
                                <div className="o-past-text">
                                    <div className="o-past-total">
                                        <div className="o-past-title">
                                            <h3>{order.shopData.name}</h3>
                                            <p>{order.shopData.address}</p>
                                        </div>
                                        <h4>₱{order.totalPrice.toFixed(2)}</h4>
                                    </div>
                                    <div className="o-past-subtext">
                                        <p>
                                            {order.status === 'cancelled_by_shop'
                                                ? 'Order was cancelled by shop'
                                                : order.status === 'cancelled_by_customer'
                                                ? 'Order was cancelled by customer'
                                                : order.status === 'cancelled_by_dasher'
                                                ? 'Order was cancelled by dasher'
                                                : order.status === 'refunded'
                                                ? 'Order was refunded'
                                                : order.status === 'no-show'
                                                ? 'Customer did not show up for delivery'
                                                : `Delivered on ${new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`}
                                        </p>
                                        <p>Order #{order.id}</p>
                                        <p>{order.paymentMethod === 'cash' ? 'Cash On Delivery' : 'GCASH'}</p> 
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default Order;
