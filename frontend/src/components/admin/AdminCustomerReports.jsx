import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext";
import axios from "../../utils/axiosConfig";
import AlertModal from "../AlertModal";
import ImageModal from "../ImageModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage, faSpinner, faQrcode } from "@fortawesome/free-solid-svg-icons";
import "../css/AdminDasherLists.css";

const AdminCustomerReports = () => {
    const { currentUser } = useAuth();
    const [pendingReports, setPendingReports] = useState([]);
    const [processedReports, setProcessedReports] = useState([]);
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
    const [showReferenceModal, setShowReferenceModal] = useState(false);
    const [referenceNumber, setReferenceNumber] = useState('');
    const [selectedReportId, setSelectedReportId] = useState(null);

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

    const handleApproveClick = async (reportId) => {
        setSelectedReportId(reportId);
        setReferenceNumber('');
        setShowReferenceModal(true);
    };

    const handleApproveWithReference = async () => {
        if (!referenceNumber.trim()) {
            openModal('Error', 'Please enter a reference number before approving.');
            return;
        }

        try {
            // First, update the status to approved
            await axios.put(`/reimburses/update/${selectedReportId}/status`, null, { 
                params: { 
                    status: 'approved'
                } 
            });
            
            // Then, update the reference number
            await axios.put(`/reimburses/update/${selectedReportId}/reference`, null, {
                params: {
                    referenceNumber: referenceNumber.trim()
                }
            });
            
            setShowReferenceModal(false);
            setReferenceNumber('');
            setSelectedReportId(null);
            openModal('Success', 'Customer refund approved successfully with reference number');
            setPendingReports((prev) => prev.filter(report => report.id !== selectedReportId));
            fetchCustomerReports();
        } catch (error) {
            console.error('Error approving customer report:', error);
            openModal('Error', 'Error approving customer refund');
        }
    };

    const handleDeclineClick = async (reportId) => {
        openModal(
            'Confirm Decline',
            'Are you sure you want to decline this customer refund?',
            async () => {
                try {
                    await axios.put(`/reimburses/update/${reportId}/status`, null, { params: { status: 'declined' } });
                    openModal('Success', 'Customer refund declined successfully');
                    setPendingReports((prev) => prev.filter(report => report.id !== reportId));
                    fetchCustomerReports();
                } catch (error) {
                    console.error('Error declining customer report:', error);
                    openModal('Error', 'Error declining customer refund');
                }
            }
        );
    };

    // Function to fetch customer no-show reports
    const fetchCustomerReports = async () => {
        setLastRefreshed(new Date());
        try {
            // Fetch customer reimbursements and all users in parallel
            const [reimburseResponse, usersResponse] = await Promise.all([
                axios.get('/reimburses/customer-reports'),
                axios.get('/users')
            ]);
            
            const pendingReportsHold = reimburseResponse.data.pendingReports || [];
            const processedReportsHold = reimburseResponse.data.processedReports || [];
            const allUsers = usersResponse.data || [];
            
            // Create a user map for O(1) lookups
            const userMap = new Map(allUsers.map(user => [user.id, user]));
            
            // Map reports with user data using the user map
            const pendingReportsData = pendingReportsHold.map(report => ({
                ...report,
                customerData: userMap.get(report.userId) || { firstname: 'Unknown', lastname: 'Customer' },
                dasherData: userMap.get(report.dasherId) || { firstname: 'Unknown', lastname: 'Dasher' }
            }));
            
            const processedReportsData = processedReportsHold.map(report => ({
                ...report,
                customerData: userMap.get(report.userId) || { firstname: 'Unknown', lastname: 'Customer' },
                dasherData: userMap.get(report.dasherId) || { firstname: 'Unknown', lastname: 'Dasher' }
            }));

            // Sort by latest (newest first) by default
            const sortedPending = pendingReportsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const sortedProcessed = processedReportsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            setPendingReports(sortedPending);
            setProcessedReports(sortedProcessed);
        } catch (error) {
            console.error('Error fetching customer reports:', error);
            openModal('Error', 'Failed to fetch customer no-show reports. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Set up initial data fetch and refresh interval
    useEffect(() => {
        fetchCustomerReports();
        
        const interval = setInterval(() => {
            fetchCustomerReports();
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

    // Function to sort reports
    const handleSortChange = (order) => {
        setSortOrder(order);
        
        const sortFunction = (a, b) => {
            if (order === 'latest') {
                return new Date(b.createdAt) - new Date(a.createdAt);
            } else {
                return new Date(a.createdAt) - new Date(b.createdAt);
            }
        };

        setPendingReports(prev => [...prev].sort(sortFunction));
        setProcessedReports(prev => [...prev].sort(sortFunction));
    };

    // Force refresh when we return to this page
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchCustomerReports();
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
                            <h2 className="text-xl md:text-2xl font-bold text-[#8B4513] mb-1">Customer No-Show Reports</h2>
                            <p className="text-[#8B4513] text-xs md:text-sm hidden sm:block">Customer-reported dasher no-shows awaiting refund processing</p>
                        </div>
                        <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button 
                                    onClick={() => navigate('/admin-reimburse')}
                                    className="px-3 md:px-4 py-1.5 md:py-2 bg-[#8B4513] hover:bg-[#6d3410] text-white rounded-lg flex items-center text-xs md:text-sm font-semibold transition-colors shadow-md hover:shadow-lg flex-1 sm:flex-none justify-center"
                                >
                                    Dasher Reports
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
                                    onClick={fetchCustomerReports}
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
                            <p className="text-[#8B4513] font-semibold">Loading customer reports...</p>
                        </div>
                    </div>
                 ): pendingReports && pendingReports.length > 0 ? (
                    <>
                        <div className="overflow-x-auto">
                            <div className="min-w-[1100px]">
                                <div className="bg-[#BC4A4D] text-white rounded-t-xl px-3 md:px-6 py-3 md:py-4 grid grid-cols-8 gap-2 md:gap-4 font-bold text-xs md:text-sm">
                                    <div>Time</div>
                                    <div>Order ID</div>
                                    <div>Customer Name</div>
                                    <div>Amount</div>
                                    <div>Proof</div>
                                    <div>GCash QR Code</div>
                                    <div>Status</div>
                                    <div>Actions</div>
                                </div>

                                <div className="bg-white rounded-b-xl shadow-lg overflow-hidden">
                                    {pendingReports.map((report, index) => (
                                        <div 
                                            key={report.id} 
                                            className={`grid grid-cols-8 gap-2 md:gap-4 px-3 md:px-6 py-3 md:py-4 items-center hover:bg-[#FFFAF1] transition-colors ${
                                                index !== pendingReports.length - 1 ? 'border-b border-gray-200' : ''
                                            }`}
                                        >
                                            <div className="text-[#8B4513] text-xs md:text-sm">{formatDate(report.createdAt)}</div>
                                            <div className="text-[#8B4513] text-xs truncate break-all" title={report.orderId}>{report.orderId}</div>
                                            <div className="font-medium text-[#8B4513] text-xs md:text-sm">{report.customerData?.firstname || 'Unknown'} {report.customerData?.lastname || 'Customer'}</div>
                                            <div className="font-semibold text-green-700 text-xs md:text-sm">₱{report.amount.toFixed(2)}</div>
                                            <div>
                                                {report.proofImage ? (
                                                    <button 
                                                        className="flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-2 md:px-3 py-1.5 md:py-2 transition-colors w-full font-semibold shadow-md hover:shadow-lg text-xs md:text-sm"
                                                        onClick={() => handleImageClick(report.proofImage)}
                                                    >
                                                        <FontAwesomeIcon icon={faImage} className="mr-2" />
                                                        View Proof
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-400 text-xs">No Proof</span>
                                                )}
                                            </div>
                                            <div>
                                                {report.gcashQr ? (
                                                    <button 
                                                        className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2 md:px-3 py-1.5 md:py-2 transition-colors w-full font-semibold shadow-md hover:shadow-lg text-xs md:text-sm"
                                                        onClick={() => handleImageClick(report.gcashQr)}
                                                    >
                                                        <FontAwesomeIcon icon={faQrcode} className="mr-2" />
                                                        View QR
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-400 text-xs">No QR</span>
                                                )}
                                            </div>
                                            <div>
                                                <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-3 py-1.5 rounded-full border border-yellow-300">
                                                    Pending
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    className="flex items-center justify-center bg-green-600 hover:bg-green-700 text-white rounded-lg px-2 md:px-3 py-1.5 md:py-2 transition-colors font-semibold shadow-md hover:shadow-lg text-xs md:text-sm"
                                                    onClick={() => handleApproveClick(report.id)}
                                                >
                                                    Approve
                                                </button>
                                                <button 
                                                    className="flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-lg px-2 md:px-3 py-1.5 md:py-2 transition-colors font-semibold shadow-md hover:shadow-lg text-xs md:text-sm"
                                                    onClick={() => handleDeclineClick(report.id)}
                                                >
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="mt-3 text-lg font-bold text-[#8B4513]">No pending customer reports</h3>
                        <p className="mt-2 text-sm text-[#8B4513]">There are currently no pending customer no-show reports.</p>
                    </div>
                )}

                <div className="mb-4 md:mb-6 mt-6 md:mt-8">
                    <div className="bg-white p-3 md:p-4 rounded-xl shadow-md">
                        <h2 className="text-xl md:text-2xl font-bold text-[#8B4513] mb-1">Processed Customer Reports</h2>
                        <p className="text-[#8B4513] text-xs md:text-sm hidden sm:block">History of processed customer no-show reports</p>
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
                 ):processedReports && processedReports.length > 0 ? (
                    <>
                        <div className="overflow-x-auto">
                            <div className="min-w-[1000px]">
                                <div className="bg-[#BC4A4D] text-white rounded-t-xl px-3 md:px-6 py-3 md:py-4 grid grid-cols-7 gap-2 md:gap-4 font-bold text-xs md:text-sm">
                                    <div>Time</div>
                                    <div>Order ID</div>
                                    <div>Customer Name</div>
                                    <div>Amount</div>
                                    <div>Proof</div>
                                    <div>Reference No.</div>
                                    <div>Status</div>
                                </div>

                                <div className="bg-white rounded-b-xl shadow-lg overflow-hidden">
                                    {processedReports.map((report, index) => (
                                        <div 
                                            key={report.id} 
                                            className={`grid grid-cols-7 gap-2 md:gap-4 px-3 md:px-6 py-3 md:py-4 items-center hover:bg-[#FFFAF1] transition-colors ${
                                                index !== processedReports.length - 1 ? 'border-b border-gray-200' : ''
                                            }`}
                                        >
                                            <div className="text-[#8B4513] text-xs md:text-sm">{formatDate(report.createdAt)}</div>
                                            <div className="text-[#8B4513] text-xs truncate break-all" title={report.orderId}>{report.orderId}</div>
                                            <div className="font-medium text-[#8B4513] text-xs md:text-sm">{report.customerData?.firstname || 'Unknown'} {report.customerData?.lastname || 'Customer'}</div>
                                            <div className="font-semibold text-green-700 text-xs md:text-sm">₱{report.amount.toFixed(2)}</div>
                                            <div>
                                                {report.proofImage ? (
                                                    <button 
                                                        className="flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-2 md:px-3 py-1.5 md:py-2 transition-colors w-full font-semibold shadow-md hover:shadow-lg text-xs md:text-sm"
                                                        onClick={() => handleImageClick(report.proofImage)}
                                                    >
                                                        <FontAwesomeIcon icon={faImage} className="mr-2" />
                                                        View Proof
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-400 text-xs">No Proof</span>
                                                )}
                                            </div>
                                            <div className="text-blue-600 font-semibold text-xs md:text-sm">{report.referenceNumber || 'N/A'}</div>
                                            <div>
                                                <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                                                    report.status === 'approved' || report.status === 'paid' 
                                                        ? 'bg-green-100 text-green-800 border border-green-300' 
                                                        : 'bg-red-100 text-red-800 border border-red-300'
                                                }`}>
                                                    {report.status === 'approved' || report.status === 'paid' ? 'Approved' : 'Declined'}
                                                </span>
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

            {/* Reference Number Modal */}
            {showReferenceModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
                        <div className="text-center mb-6">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-[#8B4513] mb-2">Enter Reference Number</h3>
                            <p className="text-sm text-gray-600">Please provide a reference number for this approved refund</p>
                        </div>
                        
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-[#8B4513] mb-2">
                                Reference Number *
                            </label>
                            <input
                                type="text"
                                value={referenceNumber}
                                onChange={(e) => setReferenceNumber(e.target.value)}
                                placeholder="Enter reference number..."
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#BC4A4D] transition-colors text-[#8B4513]"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowReferenceModal(false);
                                    setReferenceNumber('');
                                    setSelectedReportId(null);
                                }}
                                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApproveWithReference}
                                disabled={!referenceNumber.trim()}
                                className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
                                    referenceNumber.trim()
                                        ? 'bg-green-600 text-white hover:bg-green-700'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                Approve
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AdminCustomerReports;
