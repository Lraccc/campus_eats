import { faAngleDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useState } from "react";
import { useAuth } from "../../utils/AuthContext";
import axios from "../../utils/axiosConfig";
import DeclineOrderModal from './AdminDeclineOrderModal';
import AlertModal from '../AlertModal';
import "../css/AdminOrders.css";

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
      setLoading(true);
      try {
        // Fetch orders and shops in parallel
        const [ordersResponse, shopsResponse] = await Promise.all([
          axios.get('/orders/active-lists'),
          axios.get('/shops')
        ]);
        
        // Create shop map for O(1) lookups
        const shopMap = new Map(shopsResponse.data.map(shop => [shop.id, shop]));
        
        // Map orders with shop data from cache
        const ordersWithShopData = ordersResponse.data.map(order => ({
          ...order,
          shopData: shopMap.get(order.shopId) || null
        }));
        
        setOrders(ordersWithShopData);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchActiveDashers = async () => {
      try {
        // Fetch dashers and users in parallel
        const [dashersResponse, usersResponse] = await Promise.all([
          axios.get('/dashers/active'),
          axios.get('/users')
        ]);
        
        // Create user map for O(1) lookups
        const userMap = new Map(usersResponse.data.map(user => [user.id, user]));
        
        // Map dashers with user data from cache
        const dasherUser = dashersResponse.data.map(dasher => ({
          ...dasher,
          dasherData: userMap.get(dasher.id) || null
        }));
        
        setActiveDashers(dasherUser);
      } catch (error) {
        console.error('Error fetching active dashers:', error);
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
      <div className="aoh-body">
        <div className="mb-4 md:mb-6">
          <div className="bg-white p-3 md:p-4 rounded-xl shadow-md">
            <h2 className="text-xl md:text-2xl font-bold text-[#8B4513] mb-1">Incoming Orders</h2>
            <p className="text-[#8B4513] text-xs md:text-sm hidden sm:block">Orders awaiting acceptance from shops</p>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center items-center h-[40vh] w-full">
            <div className="flex flex-col items-center gap-4">
              <div
                className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-[#BC4A4D] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                role="status">
                <span
                  className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                >Loading...</span>
              </div>
              <p className="text-[#8B4513] font-semibold">Loading incoming orders...</p>
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border-2 border-gray-200 shadow-md">
            <svg className="mx-auto h-16 w-16 text-[#BC4A4D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-3 text-lg font-bold text-[#8B4513]">No incoming orders</h3>
            <p className="mt-2 text-sm text-[#8B4513]">There are currently no orders waiting for acceptance.</p>
          </div>
        ) : null}
        {orders.map((order) => (
          <div key={order.id} className="mb-3 md:mb-4">
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-3 md:p-4 cursor-pointer hover:bg-[#FFFAF1] transition-colors" onClick={() => toggleAccordion(order.id)}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4">
                  <div className="flex-shrink-0">
                    <img 
                      src={order.shopData?.imageUrl || '/Assets/Panda.png'} 
                      alt="Shop" 
                      className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg shadow-md border-2 border-gray-200" 
                    />
                  </div>
                  <div className="flex-grow">
                    <h3 className="text-base md:text-lg font-bold text-[#8B4513]">{`${order.firstname} ${order.lastname}`}</h3>
                    <p className="text-[#8B4513] text-xs md:text-sm">Order #{order.id}</p>
                    <p className="text-[#8B4513] text-xs md:text-sm">{order.paymentMethod === 'gcash' ? 'Online Payment' : 'Cash on Delivery'}</p>
                  </div>
                  <div className="flex gap-2 md:gap-3 w-full sm:w-auto">
                    <button 
                      className="flex-1 sm:flex-none px-3 md:px-6 py-1 md:py-2 bg-red-600 text-white rounded-lg shadow-md hover:bg-red-700 transition-colors text-xs md:text-sm font-semibold"
                      onClick={(e) => { e.stopPropagation(); handleDeclineClick(order.id); }}
                    >
                      Decline
                    </button>
                    <button 
                      className="flex-1 sm:flex-none px-3 md:px-6 py-1 md:py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition-colors text-xs md:text-sm font-semibold"
                      onClick={(e) => { e.stopPropagation(); handleSubmit(order.id); }}
                    >
                      Accept Order
                    </button>
                  </div>
                  <div className="flex-shrink-0 hidden sm:block">
                    <FontAwesomeIcon 
                      icon={faAngleDown} 
                      rotation={isAccordionOpen[order.id] ? 180 : 0} 
                      className="text-[#8B4513] text-xl transition-transform"
                    />
                  </div>
                </div>
              </div>
              {isAccordionOpen[order.id] && (
                <div className="border-t border-gray-200 bg-[#FFFAF1] p-3 md:p-6">
                  <div className="space-y-3 md:space-y-4">
                    <h3 className="text-base md:text-lg font-bold text-[#8B4513] mb-3 md:mb-4">Order Summary</h3>
                    {order.items.map((item, index) => (
                      <div className="flex justify-between items-center py-2 border-b border-gray-200" key={index}>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-[#BC4A4D] text-xs md:text-sm">{item.quantity}x</p>
                          <p className="text-[#8B4513] text-xs md:text-sm">{item.name}</p>
                        </div>
                        <p className="font-semibold text-[#8B4513] text-xs md:text-sm">₱{item.price}</p>
                      </div>
                    ))}
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-[#8B4513] text-xs md:text-sm">
                        <h4 className="font-semibold">Subtotal</h4>
                        <h4 className="font-semibold">₱{order.totalPrice.toFixed(2)}</h4>
                      </div>
                      <div className="flex justify-between text-[#8B4513] text-xs md:text-sm">
                        <h4 className="font-semibold">Delivery Fee</h4>
                        <h4 className="font-semibold">₱{order.shopData ? order.shopData.deliveryFee.toFixed(2) : ''}</h4>
                      </div>
                      <div className="flex justify-between text-[#8B4513] text-sm md:text-base pt-2 border-t-2 border-[#BC4A4D]">
                        <h4 className="font-bold">Total</h4>
                        <h4 className="font-bold">
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

        <div className="mt-6 md:mt-8 bg-white rounded-xl shadow-md overflow-hidden">
          <div className="bg-[#BC4A4D] p-3 md:p-4">
            <h3 className="text-lg md:text-xl font-bold text-white">Active Dashers</h3>
          </div>
          
          <div className="p-4">
            {loading ? (
              <div className="flex justify-center items-center h-[20vh] w-full">
                <div className="flex flex-col items-center gap-4">
                  <div
                    className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-[#BC4A4D] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                    role="status">
                    <span
                      className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                    >Loading...</span>
                  </div>
                  <p className="text-[#8B4513] font-semibold">Loading active dashers...</p>
                </div>
              </div>
            ) : activeDashers.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="mx-auto h-16 w-16 text-[#BC4A4D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="mt-3 text-lg font-bold text-[#8B4513]">No active dashers</h3>
                <p className="mt-2 text-sm text-[#8B4513]">There are currently no dashers available for delivery.</p>
              </div>
            ) : (
              <div className="space-y-2 md:space-y-3">
                {activeDashers.map((dasher, index) => (
                  <div key={index} className="p-3 md:p-4 bg-[#FFFAF1] rounded-lg hover:bg-[#FFF5E6] transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-[#8B4513] text-sm md:text-base">{dasher.dasherData.firstname} {dasher.dasherData.lastname}</h4>
                        <p className="text-xs md:text-sm text-[#8B4513] mt-1">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                            dasher.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {dasher.status}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
