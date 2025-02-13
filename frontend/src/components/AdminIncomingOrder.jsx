import { faAngleDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useState } from "react";
import { useAuth } from "../utils/AuthContext";
import axios from "../utils/axiosConfig";
import DeclineOrderModal from './AdminDeclineOrderModal';
import AlertModal from './AlertModal';
import "./css/AdminOrders.css";

const AdminIncomingOrder = () => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [isAccordionOpen, setIsAccordionOpen] = useState({});
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeDashers, setActiveDashers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [onConfirmAction, setOnConfirmAction] = useState(null);
  const [loading, setLoading] = useState(true);

  const openModal = (title, message, confirmAction = null) => {
    setModalTitle(title);
    setModalMessage(message);
    setOnConfirmAction(() => confirmAction);
    setIsModalOpen(true);
  };

  const closeAlertModal = () => {
    setIsModalOpen(false);
    setOnConfirmAction(null);
  };

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await axios.get('/orders/active-lists');
        const ordersWithShopData = await Promise.all(response.data.map(async order => {
          const shopDataResponse = await axios.get(`/shops/${order.shopId}`);
          const shopData = shopDataResponse.data;
          return { ...order, shopData };
        }));
        setOrders(ordersWithShopData);
      } catch (error) {
        console.error('Error fetching orders:', error);
      }finally{
        setLoading(false);
      }
    };

    const fetchActiveDashers = async () => {
      try {
        const response = await axios.get('/dashers/active');
        const dasherUser = await Promise.all(response.data.map(async dasher => {
          const dasherUserResponse = await axios.get(`/users/${dasher.id}`);
          const dasherData = dasherUserResponse.data;
          return { ...dasher, dasherData };
        }));
        setActiveDashers(dasherUser);
      } catch (error) {
        console.error('Error fetching active dashers:', error);
      }finally{
        setLoading(false);
      }
    };
    
    fetchOrders();
    fetchActiveDashers();
  }, []);

  const toggleAccordion = (orderId) => {
    setIsAccordionOpen((prevState) => ({
      ...prevState,
      [orderId]: !prevState[orderId]
    }));
  };

  const handleDeclineClick = (orderId) => {
    setSelectedOrder(orderId);
    setIsDeclineModalOpen(true);
  };

  const closeModal = () => {
    setIsDeclineModalOpen(false);
    setSelectedOrder(null);
  };

  const confirmDecline = async () => {
    // Handle decline order logic here
    try {
      console.log('Declining order:', selectedOrder);
      // Make a POST request to update the order status
      await axios.post('/orders/update-order-status', { orderId: selectedOrder, status: 'declined' });
      // Optionally, you can also update the local state if needed
      setOrders(prevOrders => {
        return prevOrders.map(order => {
          if (order.id === selectedOrder) {
            return { ...order, status: 'declined' };
          } else {
            return order;
          }
        });
      });
      openModal('Success', 'Order status declined successfully');
            setTimeout(() => {
                closeAlertModal();
                window.location.reload();
            }, 2000);
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const handleSubmit = async (orderId) => {
    try {
      // Make a POST request to update the order status
      await axios.post('/orders/update-order-status', { orderId, status: 'active_waiting_for_dasher' });
      // Optionally, you can also update the local state if needed
      setOrders(prevOrders => {
        return prevOrders.map(order => {
          if (order.id === orderId) {
            return { ...order, status: 'active_waiting_for_dasher' };
          } else {
            return order;
          }
        });
      });
      openModal('Success', 'Order status updated successfully');
            setTimeout(() => {
                closeAlertModal();
                window.location.reload();
            }, 3000);
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  return (
    <>
      <AlertModal 
                isOpen={isModalOpen} 
                closeModal={closeAlertModal} 
                title={modalTitle} 
                message={modalMessage} 
                onConfirm={onConfirmAction} 
                showConfirmButton={!!onConfirmAction}
            />
      <div className="ao-body">
        <div className="ao-title font-semibold">
          <h2>Incoming Orders</h2>
        </div>
        {loading ? (<div className="flex justify-center items-center h-[20vh] w-[80vh]">
                        <div
                            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>):orders.length === 0 && <div className="ao-no-orders">No incoming orders...</div>}
        {orders.map((order) => (
          <div key={order.id} className="ao-content-current">
            <div className="ao-card-current ao-card-large">
              <div className="ao-card-content" onClick={() => toggleAccordion(order.id)}>
                <div className="ao-order-img-holder">
                  <img src={order.shopData.imageUrl? order.shopData.imageUrl : '/Assets/Panda.png'} alt="food" className="ao-order-img" />
                </div>
                <div className="ao-card-text">
                  <h3>{`${order.firstname} ${order.lastname}`}</h3>
                  <p>{`Order #${order.id}`}</p>
                  <p>{order.paymentMethod=== 'gcash'? 'Online Payment' : 'Cash on Delivery'}</p>
                </div>
                <div className="ao-buttons">
                  <button className="p-logout-button" onClick={() => handleDeclineClick(order.id)}>Decline</button>
                  <button className="p-save-button" onClick={() => handleSubmit(order.id)}>Accept Order</button>
                </div>
                <div className="ao-toggle-content">
                  <FontAwesomeIcon icon={faAngleDown} rotation={isAccordionOpen[order.id] ? 180 : 0} />
                </div>
              </div>
              {isAccordionOpen[order.id] && (
                <div className="ao-accordion">
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
                        <h4>
                          ₱{order.totalPrice && order.shopData ? (order.totalPrice + order.shopData.deliveryFee).toFixed(2) : ''}
                        </h4>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        <div className="ao-progress-modal">
            <h3 className="ao-modal-title font-semibold">Active Dashers</h3>
            
            <div className="ao-modal-body">
            {loading ? (<div className="flex justify-center items-center h-[20vh] w-[47vh]">
                        <div
                            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>): activeDashers.length === 0 && <div>No active dashers...</div>}
                <div className="ao-items">
                {activeDashers.map((dasher, index) => (
                    <div key={index} className="ao-item">
                    <div className="ao-item-left">
                        <div className="ao-item-title">
                        <h4>{dasher.dasherData.firstname} {dasher.dasherData.lastname}</h4>
                        <p>{dasher.status}</p>
                        </div>
                    </div>
                    <div className="cm-item-right">
                        {/* Additional content for right side if needed */}
                    </div>
                    </div>
                ))}
                </div>
            </div>
            </div>

        <DeclineOrderModal 
          isOpen={isDeclineModalOpen}
          closeModal={closeModal}
          confirmDecline={confirmDecline}
        />
      </div>
    </>
  );
}

export default AdminIncomingOrder;
