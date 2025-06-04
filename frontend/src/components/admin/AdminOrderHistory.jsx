import { useEffect, useState } from "react";
import { toast } from "sonner"; // Assuming you're using sonner for toast notifications
import { useAuth } from "../../utils/AuthContext";
import axios from "../../utils/axiosConfig";
import "../css/AdminOrderHistory.css";

const AdminOrderHistory = () => {
    const { currentUser } = useAuth();
    const [completedOrders, setCompletedOrders] = useState([]);
    const [activeOrders, setActiveOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState(null);

    useEffect(() => {
        fetchCompletedOrders();
    }, []);

    const fetchCompletedOrders = async () => {
        setLoading(true); 
        try {
            const response = await axios.get('/orders/completed-orders');
            const { completedOrders, activeOrders } = response.data;

            const dashersResponse = await axios.get('/dashers');
            const dashers = dashersResponse.data;
            
            const completedOrdersData = await Promise.all(
                completedOrders.map(async (order) => {
                    const userResponse = await axios.get(`/users/${order.uid}`);
                    const userData = userResponse.data;
            
                    let dasher = null; // Default to null if no dasher exists
            
                    // Find dasher in the list by ID
                    const dasherData = dashers.find(d => d.id === order.dasherId);
                    if (dasherData) {
                        try {
                            const dasherResponse = await axios.get(`/users/${dasherData.id}`);
                            dasher = dasherResponse.data;
                        } catch (error) {
                            console.error(`Error fetching dasher data for ID: ${dasherData.id}`, error);
                        }
                    }
            
                    return { ...order, userData, dasher };
                })
            );
            
            const activeOrdersData = await Promise.all(
                activeOrders.map(async (order) => {
                    // Fetch user (customer) data
                    const userResponse = await axios.get(`/users/${order.uid}`);
                    const userData = userResponse.data;

                    let dasher = null;

                    // Find dasher by ID from dashers list
                    const dasherData = dashers.find(d => d.id === order.dasherId);
                    if (dasherData) {
                        try {
                            const dasherResponse = await axios.get(`/users/${dasherData.id}`);
                            dasher = dasherResponse.data;
                        } catch (error) {
                            console.error(`Error fetching dasher data for ID: ${dasherData.id}`, error);
                        }
                    }

                    return { ...order, userData, dasher };
                })
            );
            
            setCompletedOrders(completedOrdersData);
            setActiveOrders(activeOrdersData);
        } catch (error) {
            console.error('Error fetching completed orders:', error);
            toast.error("Failed to load orders");
        } finally {
            setLoading(false);
        }
    };

    const initiateDeleteOrder = (order) => {
        setOrderToDelete(order);
        setShowDeleteModal(true);
    };

    const confirmDeleteOrder = async () => {
        if (!orderToDelete) return;
        
        setDeleteLoading(true);
        try {
            // Use the POST endpoint instead of DELETE
            const response = await axios.post(`/orders/${orderToDelete.id}/delete`);
            
            if (response.status === 200) {
                setActiveOrders(prevOrders => prevOrders.filter(order => order.id !== orderToDelete.id));
                toast.success("Order deleted successfully");
                setShowDeleteModal(false);
                setOrderToDelete(null);
            } else {
                throw new Error("Failed to delete order");
            }
        } catch (error) {
            console.error('Error deleting order:', error);
            toast.error("Failed to delete the order. Please try again.");
        } finally {
            setDeleteLoading(false);
        }
    };

    const cancelDelete = () => {
        setShowDeleteModal(false);
        setOrderToDelete(null);
    };

    const handleDeleteOrder = async (orderId) => {
        if (!window.confirm("Are you sure you want to delete this order? This action cannot be undone.")) {
            return;
        }

        setDeleteLoading(true);
        try {
            const response = await axios.delete(`/orders/${orderId}`);
            
            if (response.status === 200) {
                setActiveOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
                toast.success("Order deleted successfully");
            } else {
                throw new Error("Failed to delete order");
            }
        } catch (error) {
            console.error('Error deleting order:', error);
            toast.error("Failed to delete the order. Please try again.");
        } finally {
            setDeleteLoading(false);
        }
    };

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
                            <div className="aoh-word">Actions</div>
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
                                        <div className="aoh-actions">
                                            <button 
                                                className="aoh-delete-btn"
                                                onClick={() => initiateDeleteOrder(order)}
                                                disabled={deleteLoading}
                                            >
                                                {deleteLoading ? 'Deleting...' : 'Delete'}
                                            </button>
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
            {showDeleteModal && (
                <div className="aoh-modal-overlay">
                    <div className="aoh-modal">
                        <div className="aoh-modal-header">
                            <h3>Confirm Deletion</h3>
                        </div>
                        <div className="aoh-modal-body">
                            <p>Are you sure you want to delete this order?</p>
                            <p className="aoh-warning-text">This action cannot be undone.</p>
                            
                            {orderToDelete && (
                                <div className="aoh-order-summary">
                                    <div><strong>Order ID:</strong> {orderToDelete.id}</div>
                                    <div><strong>Customer:</strong> {orderToDelete.userData?.username}</div>
                                    <div><strong>Total:</strong> ₱{orderToDelete.totalPrice}</div>
                                </div>
                            )}
                        </div>
                        <div className="aoh-modal-footer">
                            <button 
                                className="aoh-cancel-btn" 
                                onClick={cancelDelete}
                                disabled={deleteLoading}
                            >
                                Cancel
                            </button>
                            <button 
                                className="aoh-confirm-delete-btn" 
                                onClick={confirmDeleteOrder}
                                disabled={deleteLoading}
                            >
                                {deleteLoading ? 'Deleting...' : 'Delete Order'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
    
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
};

export default AdminOrderHistory;