import React, { useEffect, useState } from "react";
import { useAuth } from "../utils/AuthContext";
import axios from "../utils/axiosConfig"; // Use axios from axiosConfig.js
import AdminAcceptDasherModal from "./AdminAcceptDasherModal";
import AlertModal from "./AlertModal";
import ImageModal from "./ImageModal";
import "./css/AdminDasherLists.css";

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
                setPendingShops(pendingShops);
                setCurrentShops(nonPendingShops);
            } catch (error) {
                console.error('Error fetching shops:', error);
            }finally {
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
                <div className="adl-title font-semibold">
                    <h2>Pending Shops</h2>
                </div>
                {loading ? (<div className="flex justify-center items-center h-[20vh] w-[80vh]">
                        <div
                            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>): pendingShops.length > 0 ? (
                    <>
                        <div className="adl-row-container">
                            <div className="adl-word">Name</div>
                            <div className="adl-word">Address</div>
                            <div className="adl-word">Description</div>
                            <div className="adl-word">Categories</div>
                            <div className="adl-word">Shop Open Time</div>
                            <div className="adl-word">Shop Close Time</div>
                            <div className="adl-word">Banner</div>
                            <div className="adl-word">Actions</div>
                        </div>

                        <div className="adl-container">
                            {pendingShops.map(shop => (
                                <div key={shop.id} className="adl-box">
                                    <div className="adl-box-content">
                                        <div>{shop.name}</div>
                                        <div>{shop.address}</div>
                                        <div>{shop.desc}</div>
                                        <div>{shop.categories.join(', ')}</div>
                                        <div>{shop.timeOpen}</div>
                                        <div>{shop.timeClose}</div>
                                        <div>
                                            <img src={shop.imageUrl} onClick={() => handleImageClick(shop.imageUrl)} alt="shop banner" className="adl-list-pic" />
                                        </div>
                                        <div className="adl-buttons">
                                            <button className="adl-decline" onClick={() => handleDeclineClick(shop.id)}>Decline</button>
                                            <button className="adl-acceptorder" onClick={() => handleAcceptClick(shop.googleLink, shop.id)}>Accept</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div>No pending shops</div>
                )}

                <div className="adl-title font-semibold">
                    <h2>Shops</h2>
                </div>
                {loading ? (<div className="flex justify-center items-center h-[40vh] w-[80vh]">
                        <div
                            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>) : currentShops.length > 0 ? (
                    <>
                        <div className="adl-row-container">
                            <div className="adl-word">Name</div>
                            <div className="adl-word">Address</div>
                            <div className="adl-word">Description</div>
                            <div className="adl-word">Categories</div>
                            <div className="adl-word">Shop Open Time</div>
                            <div className="adl-word">Shop Close Time</div>
                            <div className="adl-word">Delivery Fee</div>
                            <div className="adl-word">Google Maps</div>
                            <div className="adl-word">Status</div>
                        </div>

                        <div className="adl-container">
                            {currentShops.map(shop => (
                                <div key={shop.id} className="adl-box">
                                    <div className="adl-box-content">
                                        <div>{shop.name}</div>
                                        <div>{shop.address}</div>
                                        <div>{shop.desc}</div>
                                        <div>{shop.categories.join(', ')}</div>
                                        <div>{shop.timeOpen}</div>
                                        <div>{shop.timeClose}</div>
                                        <div>₱{shop.deliveryFee.toFixed(2)}</div>
                                        <div>
                                            <a href={shop.googleLink} target="_blank" rel="noopener noreferrer">Link</a>
                                        </div>
                                        <div>{shop.status}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div>No current shops</div>
                )}
            </div>
            <AdminAcceptDasherModal isOpen={isModalOpen} closeModal={() => setIsModalOpen(false)} googleLink={selectedGoogleLink} shopId={selectedShopId} />
        </>
    );
};

export default AdminShopList;
