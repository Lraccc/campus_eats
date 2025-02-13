import { faAngleDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";
import axiosConfig from "../utils/axiosConfig";
import AlertModal from './AlertModal';
import "./css/DasherOrders.css";

const DasherIncomingOrder = () => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [isAccordionOpen, setIsAccordionOpen] = useState({});
  const [isActive, setIsActive] = useState(false);
  const [dasherData, setDasherData] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    showConfirmButton: false,
  });

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const response = await axiosConfig.get('/orders/incoming-orders/dasher');
        const ordersWithShopData = await Promise.all(response.data.map(async order => {
          const shopDataResponse = await axiosConfig.get(`/shops/${order.shopId}`);
          const shopData = shopDataResponse.data;
          return { ...order, shopData };
        }));
        setOrders(ordersWithShopData);
      } catch (error) {
        console.error('Error fetching orders:', error);
      }finally {
        setLoading(false);
      }
    };

    const fetchDasherData = async () => {

      if (currentUser) {
        setLoading(true);
        try {
          const response = await axiosConfig.get(`/dashers/${currentUser.id}`);
          const data = response.data;
          setDasherData(data);
          setIsActive(data.status === 'active' && data.wallet > -100);
        } catch (error) {
          console.error("Error fetching dasher data:", error);
        }finally{
          setLoading(false);
        }
      }
    };

    fetchDasherData();

    if (isActive) {
      fetchOrders();
    }
  }, [isActive, currentUser]);

  const toggleAccordion = (orderId) => {
    setIsAccordionOpen((prevState) => ({
      ...prevState,
      [orderId]: !prevState[orderId]
    }));
  };

  const handleSubmit = async (orderId) => {
    try {
        const orderResponse = await axiosConfig.get(`/orders/${orderId}`);
        const { paymentMethod } = orderResponse.data;

        // Assign dasher to the order
        const response = await axiosConfig.post('/orders/assign-dasher', { orderId, dasherId: currentUser.id });

        if (response.data.success) {
          // approving orders for cash is not shown of shop if this exists
            let newStatus = 'active_toShop';
            if (paymentMethod === 'gcash') {
                newStatus = 'active_waiting_for_shop';
            }

            // Update the order status
            await axiosConfig.post('/orders/update-order-status', { orderId, status: newStatus });

            // Update the local state
            setOrders(prevOrders => prevOrders.map(order => (
                order.id === orderId ? { ...order, dasherId: currentUser.id, status: newStatus } : order
            )));

            // Update dasher's status to "Ongoing Order"
            await updateDasherStatus('ongoing order');

            setAlertModal({
              isOpen: true,
              title: 'Success',
              message: 'Dasher assigned successfully',
              showConfirmButton: false,
          });
          setTimeout(() => {
              // Navigate to dasher orders page
              navigate('/dasher-orders');
              setAlertModal(prev => ({ ...prev, isOpen: false }));
          }, 3000);
        } else {
            setAlertModal({
              isOpen: true,
              title: 'Error',
              message: 'There was an error. Please try again. Error: ' + response.data.message,
              showConfirmButton: false,
            });
        }
    } catch (error) {
        console.error('Error assigning dasher:', error);
        setAlertModal({
          isOpen: true,
          title: 'Error',
          message: 'An error occurred while assigning the dasher. Please try again.',
          showConfirmButton: false,
      });
    }
};


  const updateDasherStatus = async (status) => {
    try {
        await axiosConfig.put(`/dashers/update/${currentUser.id}/status`, null, {
            params: { status }
        });
    } catch (error) {
        console.error('Error updating dasher status:', error);
    }
};

  const toggleButton = async () => {
    try {
      const newStatus = !isActive ? 'active' : 'offline';
      await axiosConfig.put(`/dashers/update/${currentUser.id}/status`, null, {
        params: { status: newStatus }
      });
      setIsActive(!isActive);
      if (newStatus === 'offline') {
        setOrders([]);
      } else if (dasherData.wallet <= -100) {
        setAlertModal({
          isOpen: true,
          title: 'Low Wallet Balance',
          message: 'Your wallet balance is below -100. Please top up your wallet to continue receiving orders.',
          showConfirmButton: false,
        });
        setIsActive(false);
      }
    } catch (error) {
      console.error('Error updating dasher status:', error);
    }
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
      <div className="do-body">
        <div className="j-card-large">
          <div className="do-title font-semibold">
            <h2>Incoming Orders</h2>
          </div>
          {!isActive && <div className="do-no-orders">Turn on your active status to receive incoming orders...</div>}
           {loading ? (<div className="flex justify-center items-center h-[20vh] w-[80vh]">
                        <div
                            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>):isActive && orders.length === 0 && <div className="do-no-orders">No incoming orders...</div>}
          {orders.map((order) => (
            <div key={order.id} className="do-content-current">
              <div className="do-card-current do-card-large">
                <div className="do-card-content" onClick={() => toggleAccordion(order.id)}>
                  <div className="do-order-img-holder">
                    <img src={order.shopData ? order.shopData.imageUrl : '/Assets/Panda.png'} alt="food" className="do-order-img" />
                  </div>
                  <div className="do-card-text">
                    <h3>{`${order.firstname} ${order.lastname}`}</h3>
                    <p>{`Order #${order.id}`}</p>
                    <p>{order.paymentMethod === 'gcash' ? 'Online Payment' : 'Cash on Delivery'}</p>
                    <p>{order.changeFor ? `Change for: ₱${order.changeFor}` : ''}</p>
                  </div>
                  <div className="do-buttons">
                    <button className="do-acceptorder" onClick={() => handleSubmit(order.id)}>Accept Order</button>
                  </div>
                  <div className="do-toggle-content">
                    <FontAwesomeIcon icon={faAngleDown} rotation={isAccordionOpen[order.id] ? 180 : 0} />
                  </div>
                </div>
                
                {isAccordionOpen[order.id] && (
                  <div className="do-accordion">
                    <div className="o-order-summary">
                      <h3>Order Summary</h3>
                      {order.items.map((item, index) => (
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
                          <h4>₱{order.totalPrice.toFixed(2)}</h4>
                        </div>
                        <div className="o-order-summary-subtotal">
                          <h4>Delivery Fee</h4>
                          <h4>₱{order.shopData ? order.shopData.deliveryFee.toFixed(2) : ''}</h4>
                        </div>
                        <div className="o-order-summary-total">
                          <h4>Total</h4>
                          <h4>₱{order.totalPrice && order.shopData ? (order.totalPrice + order.shopData.deliveryFee).toFixed(2) : ''}</h4>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="j-card-current-j-card-small">
          <h5>Dasher Status</h5>
          <div className="j-active-buton">
            <button onClick={toggleButton} className={isActive ? 'button-active' : 'button-inactive'}></button>
            <div className="j-button-text">
              {isActive ? 'Active' : 'Not Active'}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DasherIncomingOrder;
