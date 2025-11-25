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
    const navigate = useNavigate();
    const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [onConfirmAction, setOnConfirmAction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshInterval, setRefreshInterval] = useState(null);
    const [lastRefreshed, setLastRefreshed] = useState(new Date());

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
                    await axios.put(`/reimburses/update/${noShowId}/status`, null, { params: { status: 'declined' } });
                    openModal('Success', 'No-Show compensation status updated successfully');
                    setPendingNoShows((prev) => prev.filter(noShow => noShow.id !== noShowId));
                } catch (error) {
                    console.error('Error updating no-show status:', error);
                    openModal('Error', 'Error updating no-show status');
                }
            }
        );
    };

    const handleAcceptClick = async (noShowId) => {
        setSelectedNoShowId(noShowId);
        setIsConfirmModalOpen(true);
    };

    // Function to fetch no-show data with optimized parallel fetching
    const fetchNoShows = async () => {
        setLastRefreshed(new Date());
        try {
            // Fetch reimbursements and all users in parallel
            const [reimburseResponse, usersResponse] = await Promise.all([
                axios.get('/reimburses/pending-lists'),
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

            setPendingNoShows(pendingNoShowsData);
            setCurrentNoShows(currentNoShowsData);
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
                <div className="mb-6">
                    <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-md">
                        <div>
                            <h2 className="text-2xl font-bold text-[#8B4513] mb-1">Pending No-Show Compensation</h2>
                            <p className="text-[#8B4513] text-sm">Review and process no-show compensation requests submitted by dashers</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <button 
                                onClick={fetchNoShows}
                                className="px-4 py-2 bg-[#BC4A4D] hover:bg-[#a03e41] text-white rounded-lg flex items-center text-sm font-semibold transition-colors shadow-md hover:shadow-lg"
                            >
                                <FontAwesomeIcon icon={faSpinner} className="mr-2" /> Refresh
                            </button>
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
                        <div className="bg-[#BC4A4D] text-white rounded-t-xl px-6 py-4 grid grid-cols-7 gap-4 font-bold text-sm">
                            <div>Timestamp</div>
                            <div>Order ID</div>
                            <div>Dasher Name</div>
                            <div>Amount</div>
                            <div>Location Proof</div>
                            <div>Attempt Proof</div>
                            <div>Status</div>
                        </div>

                        <div className="bg-white rounded-b-xl shadow-lg overflow-hidden">
                            {pendingNoShows.map((noShow, index) => (
                                <div 
                                    key={noShow.id} 
                                    className={`grid grid-cols-7 gap-4 px-6 py-4 items-center hover:bg-[#FFFAF1] transition-colors ${
                                        index !== pendingNoShows.length - 1 ? 'border-b border-gray-200' : ''
                                    }`}
                                >
                                    <div className="text-[#8B4513] text-sm">{formatDate(noShow.createdAt)}</div>
                                    <div className="text-[#8B4513] text-xs truncate" title={noShow.orderId}>{noShow.orderId}</div>
                                    <div className="font-medium text-[#8B4513]">{noShow.userData?.firstname || 'Unknown'} {noShow.userData?.lastname || 'User'}</div>
                                    <div className="font-semibold text-green-700">₱{noShow.amount.toFixed(2)}</div>
                                    <div>
                                        <button 
                                            className="flex items-center justify-center bg-[#BC4A4D] hover:bg-[#a03e41] text-white rounded-lg px-3 py-2 transition-colors w-full font-semibold shadow-md hover:shadow-lg"
                                            onClick={() => handleImageClick(noShow.locationProof)}
                                        >
                                            <FontAwesomeIcon icon={faImage} className="mr-2" />
                                            View
                                        </button>
                                    </div>
                                    <div>
                                        <button 
                                            className="flex items-center justify-center bg-[#BC4A4D] hover:bg-[#a03e41] text-white rounded-lg px-3 py-2 transition-colors w-full font-semibold shadow-md hover:shadow-lg"
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
                                </div>
                            ))}
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

                <div className="mb-6 mt-8">
                    <div className="bg-white p-4 rounded-xl shadow-md">
                        <h2 className="text-2xl font-bold text-[#8B4513] mb-1">Processed No-Show Compensation</h2>
                        <p className="text-[#8B4513] text-sm">History of previously processed no-show compensation requests</p>
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
                        <div className="bg-[#BC4A4D] text-white rounded-t-xl px-6 py-4 grid grid-cols-7 gap-4 font-bold text-sm">
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
                                    className={`grid grid-cols-7 gap-4 px-6 py-4 items-center hover:bg-[#FFFAF1] transition-colors ${
                                        index !== currentNoShows.length - 1 ? 'border-b border-gray-200' : ''
                                    }`}
                                >
                                    <div className="text-[#8B4513] text-xs truncate" title={noShow.orderId}>{noShow.orderId}</div>
                                    <div className="text-[#8B4513] text-sm">{formatDate(noShow.createdAt)}</div>
                                    <div className="text-[#8B4513] text-sm">{formatDate(noShow.paidAt)}</div>
                                    <div className="text-blue-600 font-semibold">{noShow.referenceNumber}</div>
                                    <div className="font-medium text-[#8B4513]">{noShow.userData?.firstname || 'Unknown'} {noShow.userData?.lastname || 'User'}</div>
                                    <div className="text-[#8B4513]">{noShow.gcashName}</div>
                                    <div className="font-semibold text-green-700">₱{noShow.amount.toFixed(2)}</div>
                                </div>
                            ))}
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
            {/* Accept/Decline functionality removed - now just a history display */}
        </>
    );
};


export default AdminNoShowList;
