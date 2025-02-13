import React, { useEffect, useState } from "react";
import { useAuth } from "../utils/AuthContext";
import axios from "../utils/axiosConfig"; // Updated import statement
import "./css/AdminOrderHistory.css"; // Import CSS file

const AdminOrderHistory = () => {
    const { currentUser } = useAuth();
    const [completedOrders, setCompletedOrders] = useState([]);
    const [activeOrders, setActiveOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCompletedOrders = async () => {
            setLoading(true); 
            try {
                const response = await axios.get('/orders/completed-orders'); // Updated endpoint path
                const { completedOrders, activeOrders } = response.data; // Destructuring response data

                const dashersResponse = await axios.get('/dashers');
                const dashers = dashersResponse.data;
                
                const completedOrdersData = await Promise.all(
                    completedOrders.map(async (order) => {
                        // Fetch user data (customer)
                        const userResponse = await axios.get(`/users/${order.uid}`);
                        const userData = userResponse.data;
                
                        let dasher = null; // Default to null if no dasher exists
                
                        // Find dasher in the list by ID
                        const dasherData = dashers.find(d => d.id === order.dasherId);
                        if (dasherData) {
                            try {
                                const dasherResponse = await axios.get(`/users/${dasherData.id}`);
                                dasher = dasherResponse.data; // Set the dasher data from API
                                console.log("dasher", dasherResponse.data.id);
                            } catch (error) {
                                console.error(`Error fetching dasher data for ID: ${dasherData.id}`, error);
                            }
                        }
                
                        // Return the merged order data with user and dasher information
                        return { ...order, userData, dasher };
                    })
                );
                
                
              
                console.log("activeOrders", activeOrders);
                const activeOrdersData = await Promise.all(
                    activeOrders.map(async (order) => {
                        // Fetch user (customer) data
                        const userResponse = await axios.get(`/users/${order.uid}`);
                        const userData = userResponse.data;
    
                        let dasher = null; // Initialize dasher as null
    
                        // Find dasher by ID from dashers list
                        const dasherData = dashers.find(d => d.id === order.dasherId);
                        console.log("Dasher Data:", dasherData);
                        if (dasherData) {
                            try {
                                const dasherResponse = await axios.get(`/users/${dasherData.id}`);
                                dasher = dasherResponse.data;
                                console.log("Dasher (Active Order):", dasherResponse.data.id);
                            } catch (error) {
                                console.error(`Error fetching dasher data for ID: ${dasherData.id}`, error);
                            }
                        }
    
                        // Return combined data for active orders
                        return { ...order, userData, dasher };
                    })
                );
                
              
                setCompletedOrders(completedOrdersData);
                setActiveOrders(activeOrdersData);
                console.log("completedOrdersData", completedOrdersData);
                console.log("activeOrdersData", activeOrdersData);
          
            } catch (error) {
                console.error('Error fetching completed orders:', error);
            }finally{
                setLoading(false); // Set loading to false after all fetches are complete
            }
        };

      

        fetchCompletedOrders();
    }, []);

    // Helper function to format Firestore timestamp
    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString("en-US", {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <>
            <div className="aoh-body">
                <div className="aoh-title font-semibold">
                    <h2>Active Orders</h2>
                </div>
                {loading ? (
                    <div className="flex justify-center items-center h-[20vh] w-[80vh]">
                        <div
                            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status"
                        >
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>
                ) : activeOrders && activeOrders.length > 0 ? (
                    <>
                        <div className="aoh-row-container">
                            <div className="aoh-word">Order ID#</div>
                            <div className="aoh-word">Customer</div>
                            <div className="aoh-word">Created</div>
                            <div className="aoh-word">Dasher</div>
                            <div className="aoh-word">Customer Total</div>
                            <div className="aoh-word">Status</div>
                        </div>
    
                        <div className="aoh-scontainer">
                            {activeOrders.map(order => (
                                <div key={order.id} className="aoh-box">
                                    <div className="aoh-box-content">
                                        <div>{order.id}</div>
                                        <div>{order.userData?.username}</div>
                                        <div>{order.createdAt ? formatDate(order.createdAt) : 'N/A'}</div>
                                        <div>{order.dasher?.firstname} {order.dasher?.lastname}</div>
                                        <div>₱{order.totalPrice}</div>
                                        <div className={`order-status ${getStatusClass(order.status)}`}>
                                            {getStatusLabel(order.status)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div>No active orders</div>
                )}
    
                <div className="aoh-title font-semibold">
                    <h2>Orders History</h2>
                </div>
                {loading ? (
                    <div className="flex justify-center items-center h-[40vh] w-[80vh]">
                        <div
                            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status"
                        >
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>
                ) : completedOrders && completedOrders.length > 0 ? (
                    <>
                        <div className="aoh-row-container">
                            <div className="aoh-word">Order ID#</div>
                            <div className="aoh-word">Customer</div>
                            <div className="aoh-word">Created</div>
                            <div className="aoh-word">Dasher</div>
                            <div className="aoh-word">Customer Total</div>
                            <div className="aoh-word">Status</div>
                        </div>
    
                        <div className="aoh-scontainer">
                            {completedOrders.map(order => (
                                <div key={order.id} className="aoh-box">
                                    <div className="aoh-box-content">
                                        <div>{order.id}</div>
                                        <div>{order.userData?.username}</div>
                                        <div>{order.createdAt ? formatDate(order.createdAt) : 'N/A'}</div>
                                        <div>{order.dasher?.firstname} {order.dasher?.lastname}</div>
                                        <div>₱{order.totalPrice}</div>
                                        <div className={`order-status ${getStatusClass(order.status)}`}>
                                            {getStatusLabel(order.status)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div>No past orders...</div>
                )}
            </div>
        </>
    )
    
    function getStatusClass(status) {
        switch (status) {
            case 'completed':
                return 'status-completed';
            case 'cancelled_by_customer':
                return 'status-cancelled-customer';
            case 'cancelled_by_shop':
                return 'status-cancelled-shop';
            case 'no-show':
                return 'status-no-show';
            case 'active_waiting_for_confirmation':
                return 'status-waiting-confirmation';
            case 'active_waiting_for_dasher':
                return 'status-waiting-dasher';
            case 'active_waiting_for_shop':
                return 'status-waiting-shop';
            default:
                return 'status-default';
        }
    }
    
    function getStatusLabel(status) {
        switch (status) {
            case 'completed':
                return 'Completed';
            case 'cancelled_by_customer':
                return 'Cancelled by Customer';
            case 'cancelled_by_shop':
                return 'Cancelled by Shop';
            case 'no-show':
                return 'No Show';
            case 'active_waiting_for_confirmation':
                return 'Waiting for Confirmation';
            case 'active_waiting_for_dasher':
                return 'Waiting for Dasher';
            case 'active_waiting_for_shop':
                return 'Waiting for Shop';
            default:
                return status;
        }
    }
    
}

export default AdminOrderHistory;
