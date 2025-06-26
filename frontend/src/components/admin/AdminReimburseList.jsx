import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext";
import axios from "../../utils/axiosConfig";
import AdminAcceptReimburseModal from "./AdminAcceptReimburseModal";
import AlertModal from "../AlertModal";
import ImageModal from "../ImageModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage, faCheckCircle, faTimesCircle, faSpinner } from "@fortawesome/free-solid-svg-icons";
import "../css/AdminDasherLists.css";

const AdminReimburseList = () => {
    const { currentUser } = useAuth();
    const [pendingReimburses, setPendingReimburses] = useState([]);
    const [currentReimburses, setCurrentReimburses] = useState([]);
    const [isModalOpen, setModalOpen] = useState(false); // State to manage modal
    const [selectedImage, setSelectedImage] = useState("");
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [selectedReimburseId, setSelectedReimburseId] = useState(null);
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


    const handleDeclineClick = async (reimburseId) => {
        openModal(
            'Confirm Decline',
            'Are you sure you want to decline this reimburse?',
            async () => {
                try {
                    await axios.put(`/reimburses/update/${reimburseId}/status`, null, { params: { status: 'declined' } });
                    openModal('Success', 'Reimburse status updated successfully');
                    setPendingReimburses((prev) => prev.filter(reimburse => reimburse.id !== reimburseId));
                } catch (error) {
                    console.error('Error updating reimburse status:', error);
                    openModal('Error', 'Error updating reimburse status');
                }
            }
        );
    };

    const handleAcceptClick = async (reimburseId) => {
        setSelectedReimburseId(reimburseId);
        setIsConfirmModalOpen(true);
    };

    // Function to fetch reimbursement data
    const fetchReimburses = async () => {
        setLastRefreshed(new Date());
        try {
            const response = await axios.get('/reimburses/pending-lists');
            const pendingReimbursesHold = response.data.pendingReimburses || [];
            const currentReimbursesHold = response.data.nonPendingReimburses || [];
            
            console.log("Fetched pending reimburses:", pendingReimbursesHold);
            console.log("Fetched current reimburses:", currentReimbursesHold);
            
            const pendingReimbursesData = await Promise.all(
                pendingReimbursesHold.map(async (reimburse) => {
                    try {
                        const pendingReimbursesDataResponse = await axios.get(`/users/${reimburse.dasherId}`);
                        const pendingReimbursesData = pendingReimbursesDataResponse.data;
                        return { ...reimburse, userData: pendingReimbursesData };
                    } catch (error) {
                        console.error(`Error fetching user data for reimburse ${reimburse.id}:`, error);
                        return { ...reimburse, userData: { firstname: 'Unknown', lastname: 'User' } };
                    }
                })
            );
            
            const currentReimbursesData = await Promise.all(
                currentReimbursesHold.map(async (reimburse) => {
                    try {
                        const currentReimbursesDataResponse = await axios.get(`/users/${reimburse.dasherId}`);
                        const currentReimbursesData = currentReimbursesDataResponse.data;
                        return { ...reimburse, userData: currentReimbursesData };
                    } catch (error) {
                        console.error(`Error fetching user data for reimburse ${reimburse.id}:`, error);
                        return { ...reimburse, userData: { firstname: 'Unknown', lastname: 'User' } };
                    }
                })
            );

            setPendingReimburses(pendingReimbursesData);
            setCurrentReimburses(currentReimbursesData);
        } catch (error) {
            console.error('Error fetching reimburses:', error);
        } finally {
            setLoading(false);
        }
    };

    // Set up initial data fetch and refresh interval
    useEffect(() => {
        // Initial data fetch
        fetchReimburses();
        
        // Set up auto-refresh every 15 seconds
        const interval = setInterval(() => {
            console.log("Auto-refreshing reimbursement data...");
            fetchReimburses();
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
                console.log("Page is now visible, refreshing data...");
                fetchReimburses();
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
                <div className="adl-title font-semibold">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2>Pending Reimburses</h2>
                            <p className="text-gray-600 text-sm mt-1">Review and process reimbursement requests submitted by dashers</p>
                        </div>
                        <div className="text-xs text-gray-500 flex flex-col items-end">
                            <button 
                                onClick={fetchReimburses}
                                className="px-3 py-1 bg-yellow-100 hover:bg-yellow-200 rounded-md flex items-center text-sm mb-1"
                            >
                                <FontAwesomeIcon icon={faSpinner} className="mr-1" /> Refresh
                            </button>
                            <span>Last updated: {lastRefreshed.toLocaleTimeString()}</span>
                        </div>
                    </div>
                </div>
                 {loading ? (
                    <div className="flex justify-center items-center h-[20vh] w-full">
                        <div className="text-center">
                            <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-yellow-500 mb-2" />
                            <p className="text-gray-600">Loading reimbursement requests...</p>
                        </div>
                    </div>
                 ): pendingReimburses && pendingReimburses.length > 0 ? (
                    <>
                        <div className="adl-row-container bg-gray-100 rounded-t-lg">
                            <div className="adl-word font-medium">Timestamp</div>
                            <div className="adl-word font-medium">Dasher Name</div>
                            <div className="adl-word font-medium">GCASH Number</div>
                            <div className="adl-word font-medium">Amount</div>
                            <div className="adl-word font-medium">Location Proof</div>
                            <div className="adl-word font-medium">Attempt Proof</div>
                            <div className="adl-word font-medium">GCASH QR</div>
                            <div className="adl-word font-medium">Actions</div>
                        </div>

                        <div className="adl-container">
                            {pendingReimburses.map(reimburse => (
                                <div key={reimburse.id} className="adl-box">
                                    {console.log("reimburse pending: ", reimburse.userData.firstname)}
                                    <div className="adl-box-content hover:bg-gray-50 transition-colors duration-200">
                                        <div className="text-gray-700">{formatDate(reimburse.createdAt)}</div>
                                        <div className="font-medium">{reimburse.userData.firstname + " " + reimburse.userData.lastname}</div>
                                        <div className="text-gray-700">{reimburse.gcashNumber}</div>
                                        <div className="font-semibold text-green-700">₱{reimburse.amount.toFixed(2)}</div>
                                        <div>
                                            <button 
                                                className="flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-md p-2 transition-colors duration-200 w-full"
                                                onClick={() => handleImageClick(reimburse.locationProof)}
                                            >
                                                <FontAwesomeIcon icon={faImage} className="mr-1 text-yellow-500" />
                                                <span className="text-sm">View</span>
                                            </button>
                                        </div>
                                        <div>
                                            <button 
                                                className="flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-md p-2 transition-colors duration-200 w-full"
                                                onClick={() => handleImageClick(reimburse.noShowProof)}
                                            >
                                                <FontAwesomeIcon icon={faImage} className="mr-1 text-yellow-500" />
                                                <span className="text-sm">View</span>
                                            </button>
                                        </div>
                                        <div>
                                            <button 
                                                className="flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-md p-2 transition-colors duration-200 w-full"
                                                onClick={() => handleImageClick(reimburse.gcashQr)}
                                            >
                                                <FontAwesomeIcon icon={faImage} className="mr-1 text-yellow-500" />
                                                <span className="text-sm">View</span>
                                            </button>
                                        </div>
                                        <div className="adl-buttons">
                                            <button 
                                                className="adl-decline flex items-center justify-center transition-colors duration-200" 
                                                onClick={() => handleDeclineClick(reimburse.id)}
                                            >
                                                <FontAwesomeIcon icon={faTimesCircle} className="mr-1" />
                                                Decline
                                            </button>
                                            <button 
                                                className="adl-acceptorder flex items-center justify-center transition-colors duration-200" 
                                                onClick={() => handleAcceptClick(reimburse.id)}
                                            >
                                                <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />
                                                Accept
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="p-6 text-center bg-gray-50 rounded-lg border border-gray-200 mt-4">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No pending reimbursements</h3>
                        <p className="mt-1 text-sm text-gray-500">There are currently no pending reimbursement requests to process.</p>
                    </div>
                )}

                <div className="adl-title font-semibold mt-8">
                    <h2>Processed Reimbursements</h2>
                    <p className="text-gray-600 text-sm mt-1">History of previously processed reimbursement requests</p>
                </div>
                 {loading ? (
                    <div className="flex justify-center items-center h-[40vh] w-full">
                        <div className="text-center">
                            <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-yellow-500 mb-2" />
                            <p className="text-gray-600">Loading processed reimbursements...</p>
                        </div>
                    </div>
                 ):currentReimburses && currentReimburses.length > 0 ? (
                    <>
                        <div className="adl-row-container bg-gray-100 rounded-t-lg">
                            <div className="adl-word font-medium">Order ID</div>
                            <div className="adl-word font-medium">Date Requested</div>
                            <div className="adl-word font-medium">Date Paid</div>
                            <div className="adl-word font-medium">Reference No.</div>
                            <div className="adl-word font-medium">Dasher Name</div>
                            <div className="adl-word font-medium">GCASH Name</div>
                            <div className="adl-word font-medium">GCASH Number</div>
                            <div className="adl-word font-medium">Amount</div>
                            <div className="adl-word font-medium">GCASH QR</div>
                        </div>

                        <div className="adl-container">
                            {currentReimburses.map(reimburse => (
                                <div key={reimburse.id} className="adl-box">
                                    {console.log("reimburse current: ", reimburse)}
                                        <div className="adl-box-content hover:bg-gray-50 transition-colors duration-200">
                                        <div style={{fontSize:'12px'}} className="text-gray-600 truncate" title={reimburse.orderId}>{reimburse.orderId}</div>
                                        <div className="text-gray-700">{formatDate(reimburse.createdAt)}</div>
                                        <div className="text-gray-700">{formatDate(reimburse.paidAt)}</div>
                                        <div className="text-blue-600 font-medium">{reimburse.referenceNumber}</div>
                                        
                                        <div className="font-medium">{reimburse.userData.firstname + " " + reimburse.userData.lastname}</div>
                                        <div>{reimburse.gcashName}</div>
                                        <div>{reimburse.gcashNumber}</div>
                                        <div className="font-semibold text-green-700">₱{reimburse.amount.toFixed(2)}</div>
                                        
                                        <div>
                                            <button 
                                                className="flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-md p-2 transition-colors duration-200 w-full"
                                                onClick={() => handleImageClick(reimburse.gcashQr)}
                                            >
                                                <FontAwesomeIcon icon={faImage} className="mr-1 text-yellow-500" />
                                                <span className="text-sm">View</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="p-6 text-center bg-gray-50 rounded-lg border border-gray-200 mt-4">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No processed reimbursements</h3>
                        <p className="mt-1 text-sm text-gray-500">There are currently no processed reimbursement requests in the system.</p>
                    </div>
                )}
            </div>
            <AdminAcceptReimburseModal isOpen={isConfirmModalOpen} closeModal={() => setIsConfirmModalOpen(false)} reimburseId={selectedReimburseId} />
        </>
    );
};


export default AdminReimburseList;
