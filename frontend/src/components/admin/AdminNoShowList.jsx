import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext";
import axios from "../../utils/axiosConfig";
import AlertModal from "../AlertModal";
import ImageModal from "../ImageModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage, faCheckCircle, faTimesCircle, faSpinner } from "@fortawesome/free-solid-svg-icons";
import "../css/AdminDasherLists.css";

const AdminNoShowList = () => {
    const { currentUser } = useAuth();
    const [pendingNoShows, setPendingNoShows] = useState([]);
    const [currentNoShows, setCurrentNoShows] = useState([]);
    const [isModalOpen, setModalOpen] = useState(false); // State to manage modal
    const [selectedImage, setSelectedImage] = useState("");
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [selectedNoShowId, setSelectedNoShowId] = useState(null);
    const [referenceNumber, setReferenceNumber] = useState('');
    const navigate = useNavigate();
    const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [onConfirmAction, setOnConfirmAction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshInterval, setRefreshInterval] = useState(null);
    const [lastRefreshed, setLastRefreshed] = useState(new Date());
    const [sortOrder, setSortOrder] = useState('latest'); // 'latest' or 'oldest'

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
        setSelectedImage(imageSrc); // Set the selected image
        setModalOpen(true); // Open the modal
    };

    const closeModal = () => {
        setModalOpen(false); // Close the modal
        setSelectedImage(""); // Reset selected image
    };


    const handleDeclineClick = async (noShowId) => {
        openModal(
            'Confirm Decline',
            'Are you sure you want to decline this no-show compensation?',
            async () => {
                try {
                    await axios.put(`/reimburses/decline-dasher-compensation/${noShowId}`);
                    openModal('Success', 'No-Show compensation declined successfully');
                    setPendingNoShows((prev) => prev.filter(noShow => noShow.id !== noShowId));
                    fetchNoShows(); // Refresh the list
                } catch (error) {
                    console.error('Error declining no-show compensation:', error);
                    openModal('Error', 'Error declining no-show compensation');
                }
            }
        );
    };

    const handleAcceptClick = async (noShowId) => {
        setSelectedNoShowId(noShowId);
        setReferenceNumber(''); // Reset reference number
        setIsConfirmModalOpen(true);
    };
    
    const handleConfirmApproval = async () => {
        if (!referenceNumber || referenceNumber.trim() === '') {
            openModal('Error', 'Reference number is required to approve compensation');
            return;
        }
        
        try {
            await axios.put(`/reimburses/approve-dasher-compensation/${selectedNoShowId}`, null, {
                params: { referenceNumber: referenceNumber.trim() }
            });
            openModal('Success', 'No-Show compensation approved! Dasher wallet has been credited.');
            setPendingNoShows((prev) => prev.filter(noShow => noShow.id !== selectedNoShowId));
            setIsConfirmModalOpen(false);
            setSelectedNoShowId(null);
            setReferenceNumber('');
            fetchNoShows(); // Refresh the list
        } catch (error) {
            console.error('Error approving no-show compensation:', error);
            openModal('Error', 'Error approving no-show compensation');
        }
    };

    // Function to fetch no-show data with optimized parallel fetching
    const fetchNoShows = async () => {
        setLastRefreshed(new Date());
        try {
            // Fetch dasher reimbursements and all users in parallel
            const [reimburseResponse, usersResponse] = await Promise.all([
                axios.get('/reimburses/dasher-reports'),
                axios.get('/users')
            ]);
            
            const pendingNoShowsHold = reimburseResponse.data.pendingReimburses || [];
            const currentNoShowsHold = reimburseResponse.data.nonPendingReimburses || [];
            const allUsers = usersResponse.data || [];
            
            // Create a user map for O(1) lookups
            const userMap = new Map(allUsers.map(user => [user.id, user]));
            
            // Map no-shows with user data using the user map
            const pendingNoShowsData = pendingNoShowsHold.map(noShow => ({
                ...noShow,
                userData: userMap.get(noShow.dasherId) || { firstname: 'Unknown', lastname: 'User' }
            }));
            
            const currentNoShowsData = currentNoShowsHold.map(noShow => ({
                ...noShow,
                userData: userMap.get(noShow.dasherId) || { firstname: 'Unknown', lastname: 'User' }
            }));

            // Sort by latest (newest first) by default
            const sortedPending = pendingNoShowsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const sortedCurrent = currentNoShowsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            setPendingNoShows(sortedPending);
            setCurrentNoShows(sortedCurrent);
        } catch (error) {
            console.error('Error fetching no-shows:', error);
            openModal('Error', 'Failed to fetch no-show data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Set up initial data fetch and refresh interval
    useEffect(() => {
        // Initial data fetch
        fetchNoShows();
        
        // Set up auto-refresh every 15 seconds
        const interval = setInterval(() => {
            fetchNoShows();
        }, 15000); // 15 seconds refresh
        
        setRefreshInterval(interval);
        
        // Clean up interval on component unmount
        return () => {
            if (interval) clearInterval(interval);
        };
    }, []);

    if(!currentUser){
        navigate('/login');
    }

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        
        // Extracting the components
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
        const day = String(date.getDate()).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2); // Get last 2 digits of the year
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        hours = hours % 12; // Convert to 12-hour format
        hours = hours ? String(hours).padStart(2, '0') : '12'; // If hour is 0, set it to 12
    
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
                fetchNoShows();
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
                            <h2 className="text-xl md:text-2xl font-bold text-[#8B4513] mb-1">Pending No-Show Compensation</h2>
                            <p className="text-[#8B4513] text-xs md:text-sm hidden sm:block">Review and process no-show compensation requests submitted by dashers</p>
                        </div>
                        <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button 
                                    onClick={() => navigate('/admin-customer-reports')}
                                    className="px-3 md:px-4 py-1.5 md:py-2 bg-[#8B4513] hover:bg-[#6d3410] text-white rounded-lg flex items-center text-xs md:text-sm font-semibold transition-colors shadow-md hover:shadow-lg flex-1 sm:flex-none justify-center"
                                >
                                    Customer Reports
                                </button>
                                <select 
                                    value={sortOrder}
                                    onChange={(e) => handleSortChange(e.target.value)}
                                    className="px-3 md:px-4 py-1.5 md:py-2 bg-white border-2 border-[#BC4A4D] text-[#8B4513] rounded-lg text-xs md:text-sm font-semibold transition-colors shadow-md hover:shadow-lg cursor-pointer flex-1 sm:flex-none"
                                >
                                    <option value="latest">Latest First</option>
                                    <option value="oldest">Oldest First</option>
                                </select>
                                <button 
                                    onClick={fetchNoShows}
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
                            <p className="text-[#8B4513] font-semibold">Loading no-show compensation requests...</p>
                        </div>
                    </div>
                 ): pendingNoShows && pendingNoShows.length > 0 ? (
                    <>
                        <div className="overflow-x-auto">
                            <div className="min-w-[900px]">
                                <div className="bg-[#BC4A4D] text-white rounded-t-xl px-3 md:px-6 py-3 md:py-4 grid grid-cols-8 gap-2 md:gap-4 font-bold text-xs md:text-sm">
                                    <div>Timestamp</div>
                                    <div>Order ID</div>
                                    <div>Dasher Name</div>
                                    <div>Amount</div>
                                    <div>Location Proof</div>
                                    <div>Attempt Proof</div>
                                    <div>Status</div>
                                    <div>Actions</div>
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
                                            <div className="font-medium text-[#8B4513] text-xs md:text-sm">{noShow.userData?.firstname || 'Unknown'} {noShow.userData?.lastname || 'User'}</div>
                                            <div className="font-semibold text-green-700 text-xs md:text-sm">₱{noShow.amount.toFixed(2)}</div>
                                    <div>
                                        <button 
                                            className="flex items-center justify-center bg-[#BC4A4D] hover:bg-[#a03e41] text-white rounded-lg px-2 md:px-3 py-1.5 md:py-2 transition-colors w-full font-semibold shadow-md hover:shadow-lg text-xs md:text-sm"
                                            onClick={() => handleImageClick(noShow.locationProof)}
                                        >
                                            <FontAwesomeIcon icon={faImage} className="mr-2" />
                                            View
                                        </button>
                                    </div>
                                    <div>
                                        <button 
                                            className="flex items-center justify-center bg-[#BC4A4D] hover:bg-[#a03e41] text-white rounded-lg px-2 md:px-3 py-1.5 md:py-2 transition-colors w-full font-semibold shadow-md hover:shadow-lg text-xs md:text-sm"
                                            onClick={() => handleImageClick(noShow.noShowProof)}
                                        >
                                            <FontAwesomeIcon icon={faImage} className="mr-2" />
                                            View
                                        </button>
                                    </div>
                                    <div>
                                        <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-3 py-1.5 rounded-full border border-yellow-300">
                                            Pending
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            className="flex items-center justify-center bg-green-600 hover:bg-green-700 text-white rounded-lg px-2 md:px-3 py-1.5 md:py-2 transition-colors font-semibold shadow-md hover:shadow-lg text-xs md:text-sm flex-1"
                                            onClick={() => handleAcceptClick(noShow.id)}
                                        >
                                            <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />
                                            Approve
                                        </button>
                                        <button 
                                            className="flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-lg px-2 md:px-3 py-1.5 md:py-2 transition-colors font-semibold shadow-md hover:shadow-lg text-xs md:text-sm flex-1"
                                            onClick={() => handleDeclineClick(noShow.id)}
                                        >
                                            <FontAwesomeIcon icon={faTimesCircle} className="mr-1" />
                                            Decline
                                        </button>
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <h3 className="mt-3 text-lg font-bold text-[#8B4513]">No pending reimbursements</h3>
                        <p className="mt-2 text-sm text-[#8B4513]">There are currently no pending no-show compensation requests to process.</p>
                    </div>
                )}

                <div className="mb-4 md:mb-6 mt-6 md:mt-8">
                    <div className="bg-white p-3 md:p-4 rounded-xl shadow-md">
                        <h2 className="text-xl md:text-2xl font-bold text-[#8B4513] mb-1">Processed No-Show Compensation</h2>
                        <p className="text-[#8B4513] text-xs md:text-sm hidden sm:block">History of previously processed no-show compensation requests</p>
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
                            <p className="text-[#8B4513] font-semibold">Loading processed no-show compensation...</p>
                        </div>
                    </div>
                 ):currentNoShows && currentNoShows.length > 0 ? (
                    <>
                        <div className="overflow-x-auto">
                            <div className="min-w-[900px]">
                                <div className="bg-[#BC4A4D] text-white rounded-t-xl px-3 md:px-6 py-3 md:py-4 grid grid-cols-7 gap-2 md:gap-4 font-bold text-xs md:text-sm">
                                    <div>Order ID</div>
                                    <div>Date Requested</div>
                                    <div>Date Paid</div>
                            <div>Reference No.</div>
                            <div>Dasher Name</div>
                            <div>GCASH Name</div>
                            <div>Amount</div>
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
                                    <div className="text-[#8B4513] text-xs md:text-sm">{formatDate(noShow.paidAt)}</div>
                                    <div className="text-blue-600 font-semibold text-xs md:text-sm">{noShow.referenceNumber}</div>
                                    <div className="font-medium text-[#8B4513] text-xs md:text-sm">{noShow.userData?.firstname || 'Unknown'} {noShow.userData?.lastname || 'User'}</div>
                                    <div className="text-[#8B4513] text-xs md:text-sm">{noShow.gcashName}</div>
                                    <div className="font-semibold text-green-700 text-xs md:text-sm">₱{noShow.amount.toFixed(2)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    </div>
                    </>
                ) : (
                    <div className="p-8 text-center bg-white rounded-xl border-2 border-gray-200 shadow-md">
                        <svg className="mx-auto h-16 w-16 text-[#BC4A4D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <h3 className="mt-3 text-lg font-bold text-[#8B4513]">No processed no-show compensation</h3>
                        <p className="mt-2 text-sm text-[#8B4513]">There are currently no processed no-show compensation requests in the system.</p>
                    </div>
                )}
            </div>
            
            {/* Approval Modal */}
            {isConfirmModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
                        <h3 className="text-xl font-bold text-[#8B4513] mb-4">Approve No-Show Compensation</h3>
                        <p className="text-[#8B4513] mb-4">
                            Enter the GCash reference number to confirm payment and credit the dasher's wallet.
                        </p>
                        <div className="mb-4">
                            <label className="block text-[#8B4513] font-semibold mb-2">
                                GCash Reference Number <span className="text-red-600">*</span>
                            </label>
                            <input
                                type="text"
                                value={referenceNumber}
                                onChange={(e) => setReferenceNumber(e.target.value)}
                                placeholder="Enter reference number"
                                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#BC4A4D] focus:outline-none"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleConfirmApproval}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                            >
                                Confirm Approval
                            </button>
                            <button
                                onClick={() => {
                                    setIsConfirmModalOpen(false);
                                    setSelectedNoShowId(null);
                                    setReferenceNumber('');
                                }}
                                className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};


export default AdminNoShowList;
