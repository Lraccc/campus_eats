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
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
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

                // Sort by latest (newest first) by default
                const sortedPending = pendingCashoutsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                const sortedCurrent = currentCashoutsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                setPendingCashouts(sortedPending);
                setCurrentCashouts(sortedCurrent);
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

    // Function to sort cashouts
    const handleSortChange = (order) => {
        setSortOrder(order);
        
        const sortFunction = (a, b) => {
            if (order === 'latest') {
                return new Date(b.createdAt) - new Date(a.createdAt);
            } else {
                return new Date(a.createdAt) - new Date(b.createdAt);
            }
        };

        setPendingCashouts(prev => [...prev].sort(sortFunction));
        setCurrentCashouts(prev => [...prev].sort(sortFunction));
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
                <div className="mb-4 md:mb-6">
                    <div className="bg-white p-3 md:p-4 rounded-xl shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold text-[#8B4513] mb-1">Pending Cashouts</h2>
                            <p className="text-[#8B4513] text-xs md:text-sm hidden sm:block">Review and process cashout requests from shop owners</p>
                        </div>
                        <select 
                            value={sortOrder}
                            onChange={(e) => handleSortChange(e.target.value)}
                            className="px-3 md:px-4 py-1.5 md:py-2 bg-white border-2 border-[#BC4A4D] text-[#8B4513] rounded-lg text-xs md:text-sm font-semibold transition-colors shadow-md hover:shadow-lg cursor-pointer w-full sm:w-auto"
                        >
                            <option value="latest">Latest First</option>
                            <option value="oldest">Oldest First</option>
                        </select>
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
                        <div className="overflow-x-auto">
                            <div className="min-w-[900px]">
                                <div className="bg-[#BC4A4D] text-white rounded-t-xl px-3 md:px-6 py-3 md:py-4 grid grid-cols-7 gap-2 md:gap-4 font-bold text-xs md:text-sm">
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
                                            className={`grid grid-cols-7 gap-2 md:gap-4 px-3 md:px-6 py-3 md:py-4 items-center hover:bg-[#FFFAF1] transition-colors ${
                                                index !== pendingCashouts.length - 1 ? 'border-b border-gray-200' : ''
                                            }`}
                                        >
                                            <div className="text-[#8B4513] text-xs md:text-sm">{formatDate(cashout.createdAt)}</div>
                                            <div className="font-medium text-[#8B4513] text-xs md:text-sm">
                                                {cashout.userData ? 
                                                    `${cashout.userData.firstname} ${cashout.userData.lastname}` : 
                                                    `User ID: ${cashout.userId || cashout.id}`
                                                }
                                            </div>
                                            <div className="text-[#8B4513] text-xs md:text-sm">{cashout.gcashName}</div>
                                            <div className="text-[#8B4513] text-xs md:text-sm">{cashout.gcashNumber}</div>
                                            <div className="font-semibold text-green-700 text-xs md:text-sm">₱{cashout.amount.toFixed(2)}</div>
                                    
                                    <div className="flex justify-center">
                                        <img 
                                            src={cashout.gcashQr} 
                                            alt="GCASH QR" 
                                            className="w-12 h-12 md:w-16 md:h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity shadow-md border border-gray-300" 
                                            onClick={() => handleImageClick(cashout.gcashQr)}
                                        />
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                                        <button 
                                            className="px-2 md:px-4 py-1 md:py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg text-xs md:text-sm" 
                                            onClick={() => handleDeclineClick(cashout.id)}
                                        >
                                            Decline
                                        </button>
                                        <button 
                                            className="px-2 md:px-4 py-1 md:py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg text-xs md:text-sm" 
                                            onClick={() => handleAcceptClick(cashout.id)}
                                        >
                                            Accept
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    </div>
                    </>
                ) : (
                    <div className="p-6 md:p-8 text-center bg-white rounded-xl border-2 border-gray-200 shadow-md">
                        <svg className="mx-auto h-16 w-16 text-[#BC4A4D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="mt-3 text-base md:text-lg font-bold text-[#8B4513]">No pending cashouts</h3>
                        <p className="mt-2 text-xs md:text-sm text-[#8B4513]">There are currently no cashout requests to process.</p>
                    </div>
                )}

                <div className="mb-4 md:mb-6 mt-6 md:mt-8">
                    <div className="bg-white p-3 md:p-4 rounded-xl shadow-md">
                        <h2 className="text-xl md:text-2xl font-bold text-[#8B4513] mb-1">Processed Cashouts</h2>
                        <p className="text-[#8B4513] text-xs md:text-sm hidden sm:block">History of previously processed cashout requests</p>
                    </div>
                </div>
                
                {/* Search Bar */}
                {!loading && currentCashouts && currentCashouts.length > 0 && (
                    <div className="mb-4 bg-white p-4 rounded-xl shadow-md">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search by name or reference number..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1); // Reset to first page on search
                                }}
                                className="w-full px-4 py-3 pl-10 border-2 border-[#BC4A4D] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BC4A4D] text-[#8B4513] font-medium"
                            />
                            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#BC4A4D]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                )}
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
                ) : (() => {
                    // Filter cashouts based on search query
                    const filteredCashouts = currentCashouts.filter(cashout => {
                        const fullName = cashout.userData 
                            ? `${cashout.userData.firstname || ''} ${cashout.userData.lastname || ''}`.toLowerCase()
                            : '';
                        const refNumber = (cashout.referenceNumber || '').toLowerCase();
                        const query = searchQuery.toLowerCase();
                        return fullName.includes(query) || refNumber.includes(query);
                    });
                    
                    // Calculate pagination
                    const totalPages = Math.ceil(filteredCashouts.length / itemsPerPage);
                    const startIndex = (currentPage - 1) * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    const paginatedCashouts = filteredCashouts.slice(startIndex, endIndex);
                    
                    return filteredCashouts.length > 0 ? (
                        <>
                            <div className="overflow-x-auto">
                                <div className="min-w-[1000px]">
                                    <div className="bg-[#BC4A4D] text-white rounded-t-xl px-3 md:px-6 py-3 md:py-4 grid grid-cols-8 gap-2 md:gap-4 font-bold text-xs md:text-sm">
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
                                        {paginatedCashouts.map((cashout, index) => (
                                            <div 
                                                key={cashout.id} 
                                                className={`grid grid-cols-8 gap-2 md:gap-4 px-3 md:px-6 py-3 md:py-4 items-center hover:bg-[#FFFAF1] transition-colors ${
                                                    index !== paginatedCashouts.length - 1 ? 'border-b border-gray-200' : ''
                                                }`}
                                            >
                                                <div className="text-[#8B4513] text-xs md:text-sm">{formatDate(cashout.createdAt)}</div>
                                                <div className="text-[#8B4513] text-xs md:text-sm">{formatDate(cashout.paidAt)}</div>
                                                <div className="text-blue-600 font-semibold text-xs md:text-sm">{cashout.referenceNumber}</div>
                                                <div className="font-medium text-[#8B4513] text-xs md:text-sm">
                                                    {cashout.userData ? 
                                                        `${cashout.userData.firstname} ${cashout.userData.lastname}` : 
                                                        `User ID: ${cashout.userId || cashout.id}`
                                                    }
                                                </div>
                                                <div className="text-[#8B4513] text-xs md:text-sm">{cashout.gcashName}</div>
                                                <div className="text-[#8B4513] text-xs md:text-sm">{cashout.gcashNumber}</div>
                                                <div className="font-semibold text-green-700 text-xs md:text-sm">₱{cashout.amount.toFixed(2)}</div>
                                        
                                                <div className="flex justify-center">
                                                    <img 
                                                        src={cashout.gcashQr} 
                                                        alt="GCASH QR" 
                                                        className="w-12 h-12 md:w-16 md:h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity shadow-md border border-gray-300" 
                                                        onClick={() => handleImageClick(cashout.gcashQr)}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="mt-4 bg-white p-4 rounded-xl shadow-md">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm text-[#8B4513] font-medium">
                                            Showing {startIndex + 1} to {Math.min(endIndex, filteredCashouts.length)} of {filteredCashouts.length} cashouts
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                disabled={currentPage === 1}
                                                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                                                    currentPage === 1
                                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                        : 'bg-[#BC4A4D] text-white hover:bg-[#A03F42]'
                                                }`}
                                            >
                                                ← Back
                                            </button>
                                            <span className="px-4 py-2 text-[#8B4513] font-semibold">
                                                Page {currentPage} of {totalPages}
                                            </span>
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                                disabled={currentPage === totalPages}
                                                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                                                    currentPage === totalPages
                                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                        : 'bg-[#BC4A4D] text-white hover:bg-[#A03F42]'
                                                }`}
                                            >
                                                Next →
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="p-6 md:p-8 text-center bg-white rounded-xl border-2 border-gray-200 shadow-md">
                            <svg className="mx-auto h-16 w-16 text-[#BC4A4D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <h3 className="mt-3 text-base md:text-lg font-bold text-[#8B4513]">No cashouts found</h3>
                            <p className="mt-2 text-xs md:text-sm text-[#8B4513]">
                                {searchQuery ? `No cashouts match "${searchQuery}"` : 'There are currently no processed cashout requests in the system.'}
                            </p>
                        </div>
                    );
                })()}
            </div>
            <AdminAcceptCashoutModal isOpen={isConfirmModalOpen} closeModal={() => setIsConfirmModalOpen(false)} cashoutId={selectedCashoutId} />
        </>
    );
};


export default AdminCashoutList;
