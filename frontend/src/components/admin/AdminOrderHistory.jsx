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
            // Fetch all data in parallel for better performance
            const [ordersResponse, dashersResponse, usersResponse] = await Promise.all([
                axios.get('/orders/completed-orders'),
                axios.get('/dashers'),
                axios.get('/users')
            ]);

            const { completedOrders, activeOrders } = ordersResponse.data;
            const dashers = dashersResponse.data;
            const allUsers = usersResponse.data;
            
            // Create user map for O(1) lookups instead of N individual API calls
            const userMap = new Map(allUsers.map(user => [user.id, user]));
            
            // Process completed orders with cached user data
            const completedOrdersData = completedOrders.map(order => {
                const userData = userMap.get(order.uid) || null;
                
                let dasher = null;
                const dasherData = dashers.find(d => d.id === order.dasherId);
                if (dasherData) {
                    dasher = userMap.get(dasherData.id) || null;
                }
                
                return { ...order, userData, dasher };
            });
            
            // Process active orders with cached user data
            const activeOrdersData = activeOrders.map(order => {
                const userData = userMap.get(order.uid) || null;
                
                let dasher = null;
                const dasherData = dashers.find(d => d.id === order.dasherId);
                if (dasherData) {
                    dasher = userMap.get(dasherData.id) || null;
                }
                
                return { ...order, userData, dasher };
            });
            
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
            <div className="p-6 max-w-7xl mx-auto">
                <div className="mb-6">
                    <div className="bg-white p-4 rounded-xl shadow-md">
                        <h2 className="text-2xl font-bold text-[#8B4513] mb-1">Active Orders</h2>
                        <p className="text-[#8B4513] text-sm">Real-time view of all ongoing orders</p>
                    </div>
                </div>
                {loading ? (
                    <div className="flex justify-center items-center h-[40vh] w-full">
                        <div className="flex flex-col items-center gap-4">
                            <div
                                className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-[#BC4A4D] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                                role="status"
                            >
                                <span
                                    className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                                >Loading...</span>
                            </div>
                            <p className="text-[#8B4513] font-semibold">Loading active orders...</p>
                        </div>
                    </div>
                ) : activeOrders && activeOrders.length > 0 ? (
                    <>
                        <div className="bg-white rounded-xl shadow-md overflow-hidden">
                            <div className="grid grid-cols-7 gap-4 p-4 bg-[#BC4A4D] text-white font-bold text-sm">
                                <div>Order ID#</div>
                                <div>Customer</div>
                                <div>Created</div>
                                <div>Dasher</div>
                                <div>Customer Total</div>
                                <div>Status</div>
                                <div>Actions</div>
                            </div>
    
                            <div className="divide-y divide-gray-200">
                                {activeOrders.map(order => (
                                    <div key={order.id} className="grid grid-cols-7 gap-4 p-4 hover:bg-[#FFFAF1] transition-colors items-center">
                                        <div className="font-semibold text-[#8B4513] text-xs">{order.id}</div>
                                        <div className="text-[#8B4513] text-sm">{order.userData?.username}</div>
                                        <div className="text-[#8B4513] text-sm">{order.createdAt ? formatDate(order.createdAt) : 'N/A'}</div>
                                        <div className="text-[#8B4513] text-sm">{order.dasher?.firstname} {order.dasher?.lastname}</div>
                                        <div className="text-[#8B4513] font-semibold">₱{order.totalPrice}</div>
                                        <div>
                                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                                                order.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                order.status.includes('cancelled') ? 'bg-red-100 text-red-800' :
                                                order.status === 'no-show' ? 'bg-orange-100 text-orange-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {getStatusLabel(order.status)}
                                            </span>
                                        </div>
                                        <div>
                                            <button 
                                                className="px-4 py-2 bg-red-600 text-white rounded-lg shadow-md hover:bg-red-700 transition-colors text-sm font-semibold disabled:opacity-50"
                                                onClick={() => initiateDeleteOrder(order)}
                                                disabled={deleteLoading}
                                            >
                                                {deleteLoading ? 'Deleting...' : 'Delete'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="p-8 text-center bg-white rounded-xl border-2 border-gray-200 shadow-md">
                        <svg className="mx-auto h-16 w-16 text-[#BC4A4D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <h3 className="mt-3 text-lg font-bold text-[#8B4513]">No active orders</h3>
                        <p className="mt-2 text-sm text-[#8B4513]">There are currently no active orders in the system.</p>
                    </div>
                )}
    
                <div className="mb-6 mt-8">
                    <div className="bg-white p-4 rounded-xl shadow-md">
                        <h2 className="text-2xl font-bold text-[#8B4513] mb-1">Order History</h2>
                        <p className="text-[#8B4513] text-sm">Complete record of all past orders</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-[40vh] w-full">
                        <div className="flex flex-col items-center gap-4">
                            <div
                                className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-[#BC4A4D] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                                role="status"
                            >
                                <span
                                    className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                                >Loading...</span>
                            </div>
                            <p className="text-[#8B4513] font-semibold">Loading order history...</p>
                        </div>
                    </div>
                ) : completedOrders && completedOrders.length > 0 ? (
                    <>
                        <div className="bg-white rounded-xl shadow-md overflow-hidden">
                            <div className="grid grid-cols-6 gap-4 p-4 bg-[#BC4A4D] text-white font-bold text-sm">
                                <div>Order ID#</div>
                                <div>Customer</div>
                                <div>Created</div>
                                <div>Dasher</div>
                                <div>Customer Total</div>
                                <div>Status</div>
                            </div>
    
                            <div className="divide-y divide-gray-200">
                                {completedOrders.map(order => (
                                    <div key={order.id} className="grid grid-cols-6 gap-4 p-4 hover:bg-[#FFFAF1] transition-colors items-center">
                                        <div className="font-semibold text-[#8B4513] text-xs">{order.id}</div>
                                        <div className="text-[#8B4513] text-sm">{order.userData?.username}</div>
                                        <div className="text-[#8B4513] text-sm">{order.createdAt ? formatDate(order.createdAt) : 'N/A'}</div>
                                        <div className="text-[#8B4513] text-sm">{order.dasher?.firstname} {order.dasher?.lastname}</div>
                                        <div className="text-[#8B4513] font-semibold">₱{order.totalPrice}</div>
                                        <div>
                                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                                                order.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                order.status.includes('cancelled') ? 'bg-red-100 text-red-800' :
                                                order.status === 'no-show' ? 'bg-orange-100 text-orange-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {getStatusLabel(order.status)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="p-8 text-center bg-white rounded-xl border-2 border-gray-200 shadow-md">
                        <svg className="mx-auto h-16 w-16 text-[#BC4A4D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <h3 className="mt-3 text-lg font-bold text-[#8B4513]">No order history</h3>
                        <p className="mt-2 text-sm text-[#8B4513]">There are no completed or cancelled orders yet.</p>
                    </div>
                )}
            </div>
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="text-xl font-bold text-[#8B4513]">Confirm Deletion</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-[#8B4513] mb-2">Are you sure you want to delete this order?</p>
                            <p className="text-red-600 font-semibold text-sm mb-4">This action cannot be undone.</p>
                            
                            {orderToDelete && (
                                <div className="bg-[#FFFAF1] p-4 rounded-lg space-y-2">
                                    <div className="text-[#8B4513]"><strong>Order ID:</strong> {orderToDelete.id}</div>
                                    <div className="text-[#8B4513]"><strong>Customer:</strong> {orderToDelete.userData?.username}</div>
                                    <div className="text-[#8B4513]"><strong>Total:</strong> ₱{orderToDelete.totalPrice}</div>
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                            <button 
                                className="px-6 py-2 bg-gray-200 text-[#8B4513] rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50" 
                                onClick={cancelDelete}
                                disabled={deleteLoading}
                            >
                                Cancel
                            </button>
                            <button 
                                className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors shadow-md disabled:opacity-50" 
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
            case 'active_dasher_arrived':
                return 'status-dasher-arrived';
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
            case 'active_dasher_arrived':
                return 'Dasher Arrived at Shop';
            default:
                return status;
        }
    }
};

export default AdminOrderHistory;