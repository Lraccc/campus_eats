import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";
import axios from "../utils/axiosConfig";
import AdminAcceptCashoutModal from "./AdminAcceptCashoutModal";
import AlertModal from "./AlertModal";
import ImageModal from "./ImageModal";
import "./css/AdminDasherLists.css";

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
                const response = await axios.get('/cashouts/pending-lists');
                const pendingCashoutsHold = response.data.pendingCashouts;
                console.log("pendingCashoutsHold: ", pendingCashoutsHold);
                const currentCashoutsHold = response.data.nonPendingCashouts;
                console.log("currentCashoutsHold: ", currentCashoutsHold);
                const pendingCashoutsData = await Promise.all(
                    pendingCashoutsHold.map(async (cashout) => {
                        const pendingCashoutsDataResponse = await axios.get(`/users/${cashout.id}`);
                        const pendingCashoutsData = pendingCashoutsDataResponse.data;
                        return { ...cashout, userData: pendingCashoutsData };
                    })
                );
                const currentCashoutsData = await Promise.all(
                    currentCashoutsHold.map(async (cashout) => {
                        const currentCashoutsDataResponse = await axios.get(`/users/${cashout.id}`);
                        const currentCashoutsData = currentCashoutsDataResponse.data;
                        return { ...cashout, userData: currentCashoutsData };
                    })
                );
                console.log("pendingCashoutsData: ", pendingCashoutsData);
                console.log("currentCashoutsData: ", currentCashoutsData);

                setPendingCashouts(pendingCashoutsData);
                setCurrentCashouts(currentCashoutsData);
                console.log("pendingCashouts: ", pendingCashouts);
                console.log("currentCashouts: ", currentCashouts);
            } catch (error) {
                console.error('Error fetching cashouts:', error.response.data.error);
            }finally{
                setLoading(false);
            }
        };

        fetchCashouts();
        console.log("currentUser: ", currentUser);
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
                <div className="adl-title font-semibold">
                    <h2>Pending Cashouts</h2>
                </div>
                {loading ? (<div className="flex justify-center items-center h-[20vh] w-[80vh]">
                        <div
                            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>): pendingCashouts && pendingCashouts.length > 0 ? (
                    <>
                        <div className="adl-row-container">
                            <div className="adl-word">Timestamp</div>
                            <div className="adl-word">Name</div>
                            <div className="adl-word">GCASH Name</div>
                            <div className="adl-word">GCASH Number</div>
                            <div className="adl-word">Amount</div>
                            <div className="adl-word">GCASH QR</div>
                            <div className="adl-word">Actions</div>
                        </div>

                        <div className="adl-container">
                            { pendingCashouts.map(cashout => (
                                <div key={cashout.id} className="adl-box">
                                    {console.log("cashout pending: ", cashout.userData.firstname)}
                                    <div className="adl-box-content">
                                        <div>{formatDate(cashout.createdAt)}</div>
                                        <div>{cashout.userData.firstname + " " + cashout.userData.lastname}</div>
                                        <div>{cashout.gcashName}</div>
                                        <div>{cashout.gcashNumber}</div>
                                        <div>₱{cashout.amount.toFixed(2)}</div>
                                        
                                        <div>
                                        <img 
                                                src={cashout.gcashQr} 
                                                alt="GCASH QR" 
                                                className="adl-list-pic" 
                                                onClick={() => handleImageClick(cashout.gcashQr)} // Click handler
                                            />
                                        </div>
                                        <div className="adl-buttons">
                                            <button className="adl-decline" onClick={() => handleDeclineClick(cashout.id)}>Decline</button>
                                            <button className="adl-acceptorder" onClick={() => handleAcceptClick(cashout.id)}>Accept</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div>No pending cashouts</div>
                )}

                <div className="adl-title font-semibold">
                    <h2>Cashouts</h2>
                </div>
                {loading ? (<div className="flex justify-center items-center h-[40vh] w-[80vh]">
                        <div
                            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>) :currentCashouts && currentCashouts.length > 0 ? (
                    <>
                        <div className="adl-row-container">
                            <div className="adl-word">Date Requested</div>
                            <div className="adl-word">Date Paid</div>
                            <div className="adl-word">Reference No.</div>
                            <div className="adl-word">Name</div>
                            <div className="adl-word">GCASH Name</div>
                            <div className="adl-word">GCASH Number</div>
                            <div className="adl-word">Amount</div>
                            <div className="adl-word">GCASH QR</div>
                        </div>

                        <div className="adl-container">
                            {currentCashouts.map(cashout => (
                                <div key={cashout.id} className="adl-box">
                                    {console.log("cashout current: ", cashout)}
                                    <div className="adl-box-content">
                                        <div>{formatDate(cashout.createdAt)}</div>
                                        <div>{formatDate(cashout.paidAt)}</div>
                                        <div>{cashout.referenceNumber}</div>
                                        <div>{cashout.userData.firstname + " " + cashout.userData.lastname}</div>
                                        <div>{cashout.gcashName}</div>
                                        <div>{cashout.gcashNumber}</div>
                                        <div>₱{cashout.amount.toFixed(2)}</div>
                                        
                                        <div>
                                        <img 
                                                src={cashout.gcashQr} 
                                                alt="GCASH QR" 
                                                className="adl-list-pic" 
                                                onClick={() => handleImageClick(cashout.gcashQr)} // Click handler
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div>No current cashouts</div>
                )}
            </div>
            <AdminAcceptCashoutModal isOpen={isConfirmModalOpen} closeModal={() => setIsConfirmModalOpen(false)} cashoutId={selectedCashoutId} />
        </>
    );
};


export default AdminCashoutList;
