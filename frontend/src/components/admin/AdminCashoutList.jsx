import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext";
import axios from "../../utils/axiosConfig";
import AdminAcceptCashoutModal from "./AdminAcceptCashoutModal";
import AlertModal from "../AlertModal";
import ImageModal from "../ImageModal";
import "../css/AdminDasherLists.css";

const AdminCashoutList = () => {
    const { currentUser } = useAuth();
    const [pendingCashouts, setPendingCashouts] = useState([]);
    const [currentCashouts, setCurrentCashouts] = useState([]);
    const [isModalOpen, setModalOpen] = useState(false); // State to manage modal
    const [selectedImage, setSelectedImage] = useState("");
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [selectedCashoutId, setSelectedCashoutId] = useState(null);
    const navigate = useNavigate();
    const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [onConfirmAction, setOnConfirmAction] = useState(null);
    const [loading, setLoading] = useState(true);

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


    const handleDeclineClick = async (cashoutId) => {
        openModal(
            'Confirm Decline',
            'Are you sure you want to decline this cashout?',
            async () => {
                try {
                    await axios.put(`/cashouts/update/${cashoutId}/status`, null, { params: { status: 'declined' } });
                    openModal('Success', 'Cashout status updated successfully');
                    setTimeout(() => {
                        closeAlertModal();
                        setPendingCashouts((prev) => prev.filter(cashout => cashout.id !== cashoutId));
                    }, 3000);
                } catch (error) {
                    console.error('Error updating cashout status:', error);
                    openModal('Error', 'Error updating cashout status');
                }
            }
        );
    };

    const handleAcceptClick = async (cashoutId) => {
        setSelectedCashoutId(cashoutId);
        setIsConfirmModalOpen(true);
    };

    useEffect(() => {
        const fetchCashouts = async () => {
            setLoading(true);
            try {
                // Fetch cashouts and all users in parallel
                const [cashoutsResponse, usersResponse] = await Promise.all([
                    axios.get('/cashouts/pending-lists'),
                    axios.get('/users')
                ]);
                
                const pendingCashoutsHold = cashoutsResponse.data.pendingCashouts || [];
                const currentCashoutsHold = cashoutsResponse.data.nonPendingCashouts || [];
                const allUsers = usersResponse.data || [];
                
                // Create a user map for O(1) lookups
                const userMap = new Map(allUsers.map(user => [user.id, user]));
                
                // Map cashouts with user data using the user map
                const pendingCashoutsData = pendingCashoutsHold.map(cashout => ({
                    ...cashout,
                    userData: userMap.get(cashout.userId || cashout.id) || null
                }));
                
                const currentCashoutsData = currentCashoutsHold.map(cashout => ({
                    ...cashout,
                    userData: userMap.get(cashout.userId || cashout.id) || null
                }));

                setPendingCashouts(pendingCashoutsData);
                setCurrentCashouts(currentCashoutsData);
            } catch (error) {
                console.error('Error fetching cashouts:', error);
                openModal('Error', 'Failed to fetch cashout data. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchCashouts();
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
                    <div className="bg-white p-4 rounded-xl shadow-md">
                        <h2 className="text-2xl font-bold text-[#8B4513] mb-1">Pending Cashouts</h2>
                        <p className="text-[#8B4513] text-sm">Review and process cashout requests from shop owners</p>
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
                            <p className="text-[#8B4513] font-semibold">Loading cashout requests...</p>
                        </div>
                    </div>
                ) : pendingCashouts && pendingCashouts.length > 0 ? (
                    <>
                        <div className="bg-[#BC4A4D] text-white rounded-t-xl px-6 py-4 grid grid-cols-7 gap-4 font-bold text-sm">
                            <div>Timestamp</div>
                            <div>Name</div>
                            <div>GCASH Name</div>
                            <div>GCASH Number</div>
                            <div>Amount</div>
                            <div>GCASH QR</div>
                            <div className="text-center">Actions</div>
                        </div>

                        <div className="bg-white rounded-b-xl shadow-lg overflow-hidden">
                            {pendingCashouts.map((cashout, index) => (
                                <div 
                                    key={cashout.id} 
                                    className={`grid grid-cols-7 gap-4 px-6 py-4 items-center hover:bg-[#FFFAF1] transition-colors ${
                                        index !== pendingCashouts.length - 1 ? 'border-b border-gray-200' : ''
                                    }`}
                                >
                                    <div className="text-[#8B4513] text-sm">{formatDate(cashout.createdAt)}</div>
                                    <div className="font-medium text-[#8B4513]">
                                        {cashout.userData ? 
                                            `${cashout.userData.firstname} ${cashout.userData.lastname}` : 
                                            `User ID: ${cashout.userId || cashout.id}`
                                        }
                                    </div>
                                    <div className="text-[#8B4513]">{cashout.gcashName}</div>
                                    <div className="text-[#8B4513]">{cashout.gcashNumber}</div>
                                    <div className="font-semibold text-green-700">₱{cashout.amount.toFixed(2)}</div>
                                    
                                    <div className="flex justify-center">
                                        <img 
                                            src={cashout.gcashQr} 
                                            alt="GCASH QR" 
                                            className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity shadow-md border border-gray-300" 
                                            onClick={() => handleImageClick(cashout.gcashQr)}
                                        />
                                    </div>
                                    <div className="flex gap-2 justify-center">
                                        <button 
                                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg" 
                                            onClick={() => handleDeclineClick(cashout.id)}
                                        >
                                            Decline
                                        </button>
                                        <button 
                                            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg" 
                                            onClick={() => handleAcceptClick(cashout.id)}
                                        >
                                            Accept
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="p-8 text-center bg-white rounded-xl border-2 border-gray-200 shadow-md">
                        <svg className="mx-auto h-16 w-16 text-[#BC4A4D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="mt-3 text-lg font-bold text-[#8B4513]">No pending cashouts</h3>
                        <p className="mt-2 text-sm text-[#8B4513]">There are currently no cashout requests to process.</p>
                    </div>
                )}

                <div className="mb-6 mt-8">
                    <div className="bg-white p-4 rounded-xl shadow-md">
                        <h2 className="text-2xl font-bold text-[#8B4513] mb-1">Processed Cashouts</h2>
                        <p className="text-[#8B4513] text-sm">History of previously processed cashout requests</p>
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
                            <p className="text-[#8B4513] font-semibold">Loading processed cashouts...</p>
                        </div>
                    </div>
                ) : currentCashouts && currentCashouts.length > 0 ? (
                    <>
                        <div className="bg-[#BC4A4D] text-white rounded-t-xl px-6 py-4 grid grid-cols-8 gap-4 font-bold text-sm">
                            <div>Date Requested</div>
                            <div>Date Paid</div>
                            <div>Reference No.</div>
                            <div>Name</div>
                            <div>GCASH Name</div>
                            <div>GCASH Number</div>
                            <div>Amount</div>
                            <div className="text-center">GCASH QR</div>
                        </div>

                        <div className="bg-white rounded-b-xl shadow-lg overflow-hidden">
                            {currentCashouts.map((cashout, index) => (
                                <div 
                                    key={cashout.id} 
                                    className={`grid grid-cols-8 gap-4 px-6 py-4 items-center hover:bg-[#FFFAF1] transition-colors ${
                                        index !== currentCashouts.length - 1 ? 'border-b border-gray-200' : ''
                                    }`}
                                >
                                    <div className="text-[#8B4513] text-sm">{formatDate(cashout.createdAt)}</div>
                                    <div className="text-[#8B4513] text-sm">{formatDate(cashout.paidAt)}</div>
                                    <div className="text-blue-600 font-semibold">{cashout.referenceNumber}</div>
                                    <div className="font-medium text-[#8B4513]">
                                        {cashout.userData ? 
                                            `${cashout.userData.firstname} ${cashout.userData.lastname}` : 
                                            `User ID: ${cashout.userId || cashout.id}`
                                        }
                                    </div>
                                    <div className="text-[#8B4513]">{cashout.gcashName}</div>
                                    <div className="text-[#8B4513]">{cashout.gcashNumber}</div>
                                    <div className="font-semibold text-green-700">₱{cashout.amount.toFixed(2)}</div>
                                    
                                    <div className="flex justify-center">
                                        <img 
                                            src={cashout.gcashQr} 
                                            alt="GCASH QR" 
                                            className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity shadow-md border border-gray-300" 
                                            onClick={() => handleImageClick(cashout.gcashQr)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="p-8 text-center bg-white rounded-xl border-2 border-gray-200 shadow-md">
                        <svg className="mx-auto h-16 w-16 text-[#BC4A4D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="mt-3 text-lg font-bold text-[#8B4513]">No processed cashouts</h3>
                        <p className="mt-2 text-sm text-[#8B4513]">There are currently no processed cashout requests in the system.</p>
                    </div>
                )}
            </div>
            <AdminAcceptCashoutModal isOpen={isConfirmModalOpen} closeModal={() => setIsConfirmModalOpen(false)} cashoutId={selectedCashoutId} />
        </>
    );
};


export default AdminCashoutList;
