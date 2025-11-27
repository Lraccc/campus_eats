import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext";
import axios from "../../utils/axiosConfig";
import AlertModal from "../AlertModal";
import ImageModal from "../ImageModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage, faCheckCircle, faTimesCircle, faSpinner, faQrcode } from "@fortawesome/free-solid-svg-icons";
import "../css/AdminDasherLists.css";

const AdminCustomerNoShowList = () => {
    const { currentUser } = useAuth();
    const [pendingNoShows, setPendingNoShows] = useState([]);
    const [currentNoShows, setCurrentNoShows] = useState([]);
    const [isModalOpen, setModalOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState("");
    const navigate = useNavigate();
    const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [onConfirmAction, setOnConfirmAction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastRefreshed, setLastRefreshed] = useState(new Date());
    const [sortOrder, setSortOrder] = useState('latest');

    const openModal = (title, message, confirmAction = null) => {
        setModalTitle(title);
        setModalMessage(message);
        setOnConfirmAction(() => confirmAction);
        setIsAlertModalOpen(true);
    };

    const closeAlertModal = () => {
        setIsAlertModalOpen(false);
        setOnConfirmAction(null);
    };

    const handleImageClick = (imageSrc) => {
        setSelectedImage(imageSrc);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setSelectedImage("");
    };

    // Function to fetch customer no-show reports
    const fetchCustomerNoShows = async () => {
        setLastRefreshed(new Date());
        try {
            // Add cache-busting timestamp to force fresh data
            const timestamp = new Date().getTime();
            console.log('🔄 Fetching customer no-show reports with timestamp:', timestamp);
            
            // Fetch all orders and users in parallel
            const [ordersResponse, usersResponse] = await Promise.all([
                axios.get(`/orders?_t=${timestamp}`),
                axios.get(`/users?_t=${timestamp}`)
            ]);
            
            const allOrders = ordersResponse.data || [];
            const allUsers = usersResponse.data || [];
            
            console.log('📦 Total orders fetched:', allOrders.length);
            
            // Create user map for quick lookups
            const userMap = new Map(allUsers.map(user => [user.id, user]));
            
            // Filter orders that are customer-reported no-shows (pending confirmation or confirmed)
            const pendingReports = allOrders.filter(order => 
                order.status === 'active_waiting_for_no_show_confirmation'
            );
            
            console.log('⏳ Pending no-show reports:', pendingReports.length);
            
            const confirmedReports = allOrders.filter(order => 
                order.status === 'dasher-no-show' || 
                order.status === 'no-show-resolved' ||
                order.status === 'no_show_resolved'
            );
            
            // Map reports with customer data
            const pendingNoShowsData = pendingReports.map(order => {
                console.log('📊 Mapping pending report:', {
                    orderId: order.id,
                    customerProof: order.customerNoShowProofImage,
                    gcashQr: order.customerNoShowGcashQr,
                    deliveryProof: order.deliveryProofImage
                });
                
                return {
                    id: order.id,
                    orderId: order.id,
                    customerId: order.uid,
                    dasherId: order.dasherId,
                    amount: order.totalPrice,
                    createdAt: order.createdAt,
                    status: 'pending',
                    customerNoShowProofImage: order.customerNoShowProofImage,
                    customerNoShowGcashQr: order.customerNoShowGcashQr,
                    deliveryProofImage: order.deliveryProofImage,
                    customerData: userMap.get(order.uid) || { firstname: 'Unknown', lastname: 'User' },
                    dasherData: userMap.get(order.dasherId) || { firstname: 'Unknown', lastname: 'Dasher' }
                };
            });
            
            const currentNoShowsData = confirmedReports.map(order => ({
                id: order.id,
                orderId: order.id,
                customerId: order.uid,
                dasherId: order.dasherId,
                amount: order.totalPrice,
                createdAt: order.createdAt,
                status: order.status === 'dasher-no-show' ? 'confirmed' : 'resolved',
                customerNoShowProofImage: order.customerNoShowProofImage,
                customerNoShowGcashQr: order.customerNoShowGcashQr,
                deliveryProofImage: order.deliveryProofImage,
                customerData: userMap.get(order.uid) || { firstname: 'Unknown', lastname: 'User' },
                dasherData: userMap.get(order.dasherId) || { firstname: 'Unknown', lastname: 'Dasher' }
            }));

            // Sort by latest (newest first) by default
            const sortedPending = pendingNoShowsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const sortedCurrent = currentNoShowsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            setPendingNoShows(sortedPending);
            setCurrentNoShows(sortedCurrent);
        } catch (error) {
            console.error('Error fetching customer no-shows:', error);
            openModal('Error', 'Failed to fetch customer no-show reports. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Set up initial data fetch and refresh interval
    useEffect(() => {
        fetchCustomerNoShows();
        
        const interval = setInterval(() => {
            fetchCustomerNoShows();
        }, 15000); // 15 seconds refresh
        
        return () => {
            if (interval) clearInterval(interval);
        };
    }, []);

    if(!currentUser){
        navigate('/login');
    }

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        hours = hours % 12;
        hours = hours ? String(hours).padStart(2, '0') : '12';
    
        return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
    };

    // Function to sort no-shows
    const handleSortChange = (order) => {
        setSortOrder(order);
        
        const sortFunction = (a, b) => {
            if (order === 'latest') {
                return new Date(b.createdAt) - new Date(a.createdAt);
            } else {
                return new Date(a.createdAt) - new Date(b.createdAt);
            }
        };

        setPendingNoShows(prev => [...prev].sort(sortFunction));
        setCurrentNoShows(prev => [...prev].sort(sortFunction));
    };

    // Force refresh when we return to this page
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchCustomerNoShows();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    return (
        <>
          <AlertModal 
                isOpen={isAlertModalOpen} 
                closeModal={closeAlertModal} 
                title={modalTitle} 
                message={modalMessage} 
                onConfirm={onConfirmAction} 
                showConfirmButton={!!onConfirmAction}
            />  
            <div className="adl-body">
                <ImageModal 
                    isOpen={isModalOpen} 
                    imageSrc={selectedImage} 
                    onClose={closeModal} 
                />
                <div className="mb-4 md:mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 md:p-4 rounded-xl shadow-md gap-3 md:gap-0">
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold text-[#8B4513] mb-1">Pending Customer No-Show Reports</h2>
                            <p className="text-[#8B4513] text-xs md:text-sm hidden sm:block">Review customer-reported dasher no-show incidents under investigation</p>
                        </div>
                        <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                            <div className="flex gap-2 w-full sm:w-auto">
                                <select 
                                    value={sortOrder}
                                    onChange={(e) => handleSortChange(e.target.value)}
                                    className="px-3 md:px-4 py-1.5 md:py-2 bg-white border-2 border-[#BC4A4D] text-[#8B4513] rounded-lg text-xs md:text-sm font-semibold transition-colors shadow-md hover:shadow-lg cursor-pointer flex-1 sm:flex-none"
                                >
                                    <option value="latest">Latest First</option>
                                    <option value="oldest">Oldest First</option>
                                </select>
                                <button 
                                    onClick={fetchCustomerNoShows}
                                    className="px-3 md:px-4 py-1.5 md:py-2 bg-[#BC4A4D] hover:bg-[#a03e41] text-white rounded-lg flex items-center text-xs md:text-sm font-semibold transition-colors shadow-md hover:shadow-lg flex-1 sm:flex-none justify-center"
                                >
                                    <FontAwesomeIcon icon={faSpinner} className="mr-2" /> Refresh
                                </button>
                            </div>
                            <span className="text-xs text-gray-500">Last updated: {lastRefreshed.toLocaleTimeString()}</span>
                        </div>
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
                            <p className="text-[#8B4513] font-semibold">Loading customer no-show reports...</p>
                        </div>
                    </div>
                 ): pendingNoShows && pendingNoShows.length > 0 ? (
                    <>
                        <div className="overflow-x-auto">
                            <div className="min-w-[1000px]">
                                <div className="bg-[#BC4A4D] text-white rounded-t-xl px-3 md:px-6 py-3 md:py-4 grid grid-cols-8 gap-2 md:gap-4 font-bold text-xs md:text-sm">
                                    <div>Timestamp</div>
                                    <div>Order ID</div>
                                    <div>Customer Name</div>
                                    <div>Reported Dasher</div>
                                    <div>Amount</div>
                                    <div>Customer Proof</div>
                                    <div>GCash QR</div>
                                    <div>Dasher Counter-Proof</div>
                                </div>

                                <div className="bg-white rounded-b-xl shadow-lg overflow-hidden">
                                    {pendingNoShows.map((noShow, index) => (
                                        <div 
                                            key={noShow.id} 
                                            className={`grid grid-cols-8 gap-2 md:gap-4 px-3 md:px-6 py-3 md:py-4 items-center hover:bg-[#FFFAF1] transition-colors ${
                                                index !== pendingNoShows.length - 1 ? 'border-b border-gray-200' : ''
                                            }`}
                                        >
                                            <div className="text-[#8B4513] text-xs md:text-sm">{formatDate(noShow.createdAt)}</div>
                                            <div className="text-[#8B4513] text-xs truncate break-all" title={noShow.orderId}>{noShow.orderId}</div>
                                            <div className="font-medium text-[#8B4513] text-xs md:text-sm">{noShow.customerData?.firstname || 'Unknown'} {noShow.customerData?.lastname || 'User'}</div>
                                            <div className="font-medium text-[#8B4513] text-xs md:text-sm">{noShow.dasherData?.firstname || 'Unknown'} {noShow.dasherData?.lastname || 'Dasher'}</div>
                                            <div className="font-semibold text-green-700 text-xs md:text-sm">₱{noShow.amount.toFixed(2)}</div>
                                            <div>
                                                {noShow.customerNoShowProofImage && noShow.customerNoShowProofImage.trim() !== '' ? (
                                                    <button 
                                                        className="flex items-center justify-center bg-[#BC4A4D] hover:bg-[#a03e41] text-white rounded-lg px-2 md:px-3 py-1.5 md:py-2 transition-colors w-full font-semibold shadow-md hover:shadow-lg text-xs md:text-sm"
                                                        onClick={() => {
                                                            console.log('🖼️ Opening proof image:', noShow.customerNoShowProofImage);
                                                            handleImageClick(noShow.customerNoShowProofImage);
                                                        }}
                                                    >
                                                        <FontAwesomeIcon icon={faImage} className="mr-2" />
                                                        View
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-400 text-xs" title={`Value: ${noShow.customerNoShowProofImage || 'null/undefined'}`}>No proof</span>
                                                )}
                                            </div>
                                            <div>
                                                {noShow.customerNoShowGcashQr && noShow.customerNoShowGcashQr.trim() !== '' ? (
                                                    <button 
                                                        className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2 md:px-3 py-1.5 md:py-2 transition-colors w-full font-semibold shadow-md hover:shadow-lg text-xs md:text-sm"
                                                        onClick={() => {
                                                            console.log('📱 Opening GCash QR:', noShow.customerNoShowGcashQr);
                                                            handleImageClick(noShow.customerNoShowGcashQr);
                                                        }}
                                                    >
                                                        <FontAwesomeIcon icon={faQrcode} className="mr-2" />
                                                        View QR
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-400 text-xs" title={`Value: ${noShow.customerNoShowGcashQr || 'null/undefined'}`}>No QR</span>
                                                )}
                                            </div>
                                            <div>
                                                {noShow.deliveryProofImage ? (
                                                    <button 
                                                        className="flex items-center justify-center bg-green-600 hover:bg-green-700 text-white rounded-lg px-2 md:px-3 py-1.5 md:py-2 transition-colors w-full font-semibold shadow-md hover:shadow-lg text-xs md:text-sm"
                                                        onClick={() => handleImageClick(noShow.deliveryProofImage)}
                                                    >
                                                        <FontAwesomeIcon icon={faImage} className="mr-2" />
                                                        View
                                                    </button>
                                                ) : (
                                                    <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded-full">
                                                        Pending
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="p-8 text-center bg-white rounded-xl border-2 border-gray-200 shadow-md">
                        <svg className="mx-auto h-16 w-16 text-[#BC4A4D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="mt-3 text-lg font-bold text-[#8B4513]">No pending customer reports</h3>
                        <p className="mt-2 text-sm text-[#8B4513]">There are currently no pending customer no-show reports to review.</p>
                    </div>
                )}

                <div className="mb-4 md:mb-6 mt-6 md:mt-8">
                    <div className="bg-white p-3 md:p-4 rounded-xl shadow-md">
                        <h2 className="text-xl md:text-2xl font-bold text-[#8B4513] mb-1">Processed Customer No-Show Reports</h2>
                        <p className="text-[#8B4513] text-xs md:text-sm hidden sm:block">History of resolved customer no-show reports</p>
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
                            <p className="text-[#8B4513] font-semibold">Loading processed reports...</p>
                        </div>
                    </div>
                 ):currentNoShows && currentNoShows.length > 0 ? (
                    <>
                        <div className="overflow-x-auto">
                            <div className="min-w-[1000px]">
                                <div className="bg-[#BC4A4D] text-white rounded-t-xl px-3 md:px-6 py-3 md:py-4 grid grid-cols-7 gap-2 md:gap-4 font-bold text-xs md:text-sm">
                                    <div>Order ID</div>
                                    <div>Date Reported</div>
                                    <div>Customer Name</div>
                                    <div>Reported Dasher</div>
                                    <div>Amount</div>
                                    <div>Status</div>
                                    <div>Evidence</div>
                                </div>

                                <div className="bg-white rounded-b-xl shadow-lg overflow-hidden">
                                    {currentNoShows.map((noShow, index) => (
                                        <div 
                                            key={noShow.id} 
                                            className={`grid grid-cols-7 gap-2 md:gap-4 px-3 md:px-6 py-3 md:py-4 items-center hover:bg-[#FFFAF1] transition-colors ${
                                                index !== currentNoShows.length - 1 ? 'border-b border-gray-200' : ''
                                            }`}
                                        >
                                            <div className="text-[#8B4513] text-xs truncate break-all" title={noShow.orderId}>{noShow.orderId}</div>
                                            <div className="text-[#8B4513] text-xs md:text-sm">{formatDate(noShow.createdAt)}</div>
                                            <div className="font-medium text-[#8B4513] text-xs md:text-sm">{noShow.customerData?.firstname || 'Unknown'} {noShow.customerData?.lastname || 'User'}</div>
                                            <div className="font-medium text-[#8B4513] text-xs md:text-sm">{noShow.dasherData?.firstname || 'Unknown'} {noShow.dasherData?.lastname || 'Dasher'}</div>
                                            <div className="font-semibold text-green-700 text-xs md:text-sm">₱{noShow.amount.toFixed(2)}</div>
                                            <div>
                                                <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                                                    noShow.status === 'confirmed' 
                                                        ? 'bg-red-100 text-red-800 border border-red-300' 
                                                        : 'bg-green-100 text-green-800 border border-green-300'
                                                }`}>
                                                    {noShow.status === 'confirmed' ? 'Confirmed No-Show' : 'Resolved'}
                                                </span>
                                            </div>
                                            <div className="flex gap-1">
                                                {noShow.customerNoShowProofImage && (
                                                    <button 
                                                        className="flex items-center justify-center bg-[#BC4A4D] hover:bg-[#a03e41] text-white rounded-lg px-2 py-1 transition-colors font-semibold shadow-md text-xs"
                                                        onClick={() => handleImageClick(noShow.customerNoShowProofImage)}
                                                        title="View customer proof"
                                                    >
                                                        <FontAwesomeIcon icon={faImage} />
                                                    </button>
                                                )}
                                                {noShow.customerNoShowGcashQr && (
                                                    <button 
                                                        className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2 py-1 transition-colors font-semibold shadow-md text-xs"
                                                        onClick={() => handleImageClick(noShow.customerNoShowGcashQr)}
                                                        title="View GCash QR"
                                                    >
                                                        <FontAwesomeIcon icon={faQrcode} />
                                                    </button>
                                                )}
                                                {noShow.deliveryProofImage && (
                                                    <button 
                                                        className="flex items-center justify-center bg-green-600 hover:bg-green-700 text-white rounded-lg px-2 py-1 transition-colors font-semibold shadow-md text-xs"
                                                        onClick={() => handleImageClick(noShow.deliveryProofImage)}
                                                        title="View dasher counter-proof"
                                                    >
                                                        <FontAwesomeIcon icon={faImage} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="p-8 text-center bg-white rounded-xl border-2 border-gray-200 shadow-md">
                        <svg className="mx-auto h-16 w-16 text-[#BC4A4D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="mt-3 text-lg font-bold text-[#8B4513]">No processed customer reports</h3>
                        <p className="mt-2 text-sm text-[#8B4513]">There are currently no processed customer no-show reports in the system.</p>
                    </div>
                )}
            </div>
        </>
    );
};

export default AdminCustomerNoShowList;
