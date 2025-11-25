import React, { useEffect, useState } from "react";
import { useAuth } from "../../utils/AuthContext";
import axios from "../../utils/axiosConfig"; // Use axios from axiosConfig.js
import AdminAcceptDasherModal from "./AdminAcceptDasherModal";
import AlertModal from "../AlertModal";
import ImageModal from "../ImageModal";
import "../css/AdminDasherLists.css";

const AdminShopList = () => {
    const { currentUser } = useAuth();
    const [pendingShops, setPendingShops] = useState([]);
    const [currentShops, setCurrentShops] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedGoogleLink, setSelectedGoogleLink] = useState(null);
    const [selectedShopId, setSelectedShopId] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [onConfirmAction, setOnConfirmAction] = useState(null);
    const [loading,setLoading] = useState(true);

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

    const closeModal = () => {
        setImageModalOpen(false); // Close the modal
        setSelectedImage(""); // Reset selected image
    };
    const handleImageClick = (imageSrc) => {
        setSelectedImage(imageSrc); // Set the selected image
        setImageModalOpen(true); // Open the modal
    };

    const handleDeclineClick = (shopId) => {
        openModal(
            "Confirm Decline",
            "Are you sure you want to decline this shop?",
            async () => {
                try {
                    await axios.put(`/shops/update/${shopId}/status`, null, { params: { status: 'declined' } });
                    // Optionally update the state to remove the declined shop from the list
                    setPendingShops(pendingShops.filter(shop => shop.id !== shopId));
                } catch (error) {
                    console.error('Error updating shop status:', error);
                    openModal("Error", "Error updating shop status");
                }
            }
        );
    };

    const handleAcceptClick = (googleLink, shopId) => {
        setSelectedShopId(shopId);
        setSelectedGoogleLink(googleLink);
        setIsModalOpen(true);
    };

    useEffect(() => {
        const fetchShops = async () => {
            setLoading(true);
            try {
                const response = await axios.get('/shops/pending-lists');
                const { pendingShops, nonPendingShops } = response.data;
                setPendingShops(pendingShops || []);
                setCurrentShops(nonPendingShops || []);
            } catch (error) {
                console.error('Error fetching shops:', error);
                openModal("Error", "Failed to load shops. Please try again.");
                setPendingShops([]);
                setCurrentShops([]);
            } finally {
                setLoading(false);
            }
        };

        fetchShops();
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
                    isOpen={imageModalOpen} 
                    imageSrc={selectedImage} 
                    onClose={closeModal} 
                />
                <div className="mb-6">
                    <div className="bg-white p-4 rounded-xl shadow-md">
                        <h2 className="text-2xl font-bold text-[#8B4513] mb-1">Pending Shops</h2>
                        <p className="text-[#8B4513] text-sm">Review and approve shop applications</p>
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
                            <p className="text-[#8B4513] font-semibold">Loading pending shops...</p>
                        </div>
                    </div>
                ) : pendingShops.length > 0 ? (
                    <>
                        <div className="bg-[#BC4A4D] text-white rounded-t-xl px-6 py-4 grid grid-cols-8 gap-4 font-bold text-sm">
                            <div>Name</div>
                            <div>Address</div>
                            <div>Description</div>
                            <div>Categories</div>
                            <div>Open Time</div>
                            <div>Close Time</div>
                            <div>Banner</div>
                            <div className="text-center">Actions</div>
                        </div>

                        <div className="bg-white rounded-b-xl shadow-lg overflow-hidden">
                            {pendingShops.map((shop, index) => (
                                <div 
                                    key={shop.id} 
                                    className={`grid grid-cols-8 gap-4 px-6 py-4 items-center hover:bg-[#FFFAF1] transition-colors ${
                                        index !== pendingShops.length - 1 ? 'border-b border-gray-200' : ''
                                    }`}
                                >
                                    <div className="font-medium text-[#8B4513]">{shop.name}</div>
                                    <div className="text-[#8B4513] text-sm">{shop.address}</div>
                                    <div className="text-[#8B4513] text-sm truncate" title={shop.desc}>{shop.desc}</div>
                                    <div className="text-[#8B4513] text-sm">{shop.categories.join(', ')}</div>
                                    <div className="text-[#8B4513]">{shop.timeOpen}</div>
                                    <div className="text-[#8B4513]">{shop.timeClose}</div>
                                    <div className="flex justify-center">
                                        <img 
                                            src={shop.imageUrl} 
                                            onClick={() => handleImageClick(shop.imageUrl)} 
                                            alt="shop banner" 
                                            className="w-20 h-20 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity shadow-md border border-gray-300" 
                                        />
                                    </div>
                                    <div className="flex gap-2 justify-center">
                                        <button 
                                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg" 
                                            onClick={() => handleDeclineClick(shop.id)}
                                        >
                                            Decline
                                        </button>
                                        <button 
                                            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg" 
                                            onClick={() => handleAcceptClick(shop.googleLink, shop.id)}
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <h3 className="mt-3 text-lg font-bold text-[#8B4513]">No pending shops</h3>
                        <p className="mt-2 text-sm text-[#8B4513]">There are currently no shop applications to review.</p>
                    </div>
                )}

                <div className="mb-6 mt-8">
                    <div className="bg-white p-4 rounded-xl shadow-md">
                        <h2 className="text-2xl font-bold text-[#8B4513] mb-1">Active Shops</h2>
                        <p className="text-[#8B4513] text-sm">All approved and active shops on the platform</p>
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
                            <p className="text-[#8B4513] font-semibold">Loading active shops...</p>
                        </div>
                    </div>
                ) : currentShops.length > 0 ? (
                    <>
                        <div className="bg-[#BC4A4D] text-white rounded-t-xl px-6 py-4 grid grid-cols-9 gap-4 font-bold text-sm">
                            <div>Name</div>
                            <div>Address</div>
                            <div>Description</div>
                            <div>Categories</div>
                            <div>Open Time</div>
                            <div>Close Time</div>
                            <div>Delivery Fee</div>
                            <div>Google Maps</div>
                            <div>Status</div>
                        </div>

                        <div className="bg-white rounded-b-xl shadow-lg overflow-hidden">
                            {currentShops.map((shop, index) => (
                                <div 
                                    key={shop.id} 
                                    className={`grid grid-cols-9 gap-4 px-6 py-4 items-center hover:bg-[#FFFAF1] transition-colors ${
                                        index !== currentShops.length - 1 ? 'border-b border-gray-200' : ''
                                    }`}
                                >
                                    <div className="font-medium text-[#8B4513]">{shop.name}</div>
                                    <div className="text-[#8B4513] text-sm">{shop.address}</div>
                                    <div className="text-[#8B4513] text-sm truncate" title={shop.desc}>{shop.desc}</div>
                                    <div className="text-[#8B4513] text-sm">{shop.categories.join(', ')}</div>
                                    <div className="text-[#8B4513]">{shop.timeOpen}</div>
                                    <div className="text-[#8B4513]">{shop.timeClose}</div>
                                    <div className="font-semibold text-green-700">₱{shop.deliveryFee.toFixed(2)}</div>
                                    <div>
                                        <a 
                                            href={shop.googleLink} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 font-medium underline"
                                        >
                                            View Map
                                        </a>
                                    </div>
                                    <div>
                                        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                                            shop.status === 'active' 
                                                ? 'bg-green-100 text-green-800 border border-green-300' 
                                                : 'bg-gray-100 text-gray-800 border border-gray-300'
                                        }`}>
                                            {shop.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="p-8 text-center bg-white rounded-xl border-2 border-gray-200 shadow-md">
                        <svg className="mx-auto h-16 w-16 text-[#BC4A4D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <h3 className="mt-3 text-lg font-bold text-[#8B4513]">No active shops</h3>
                        <p className="mt-2 text-sm text-[#8B4513]">There are currently no active shops in the system.</p>
                    </div>
                )}
            </div>
            <AdminAcceptDasherModal isOpen={isModalOpen} closeModal={() => setIsModalOpen(false)} googleLink={selectedGoogleLink} shopId={selectedShopId} />
        </>
    );
};

export default AdminShopList;
