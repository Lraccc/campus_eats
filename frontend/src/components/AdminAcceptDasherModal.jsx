import React, { useState } from "react";
import axios from "../utils/axiosConfig"; // Import axiosConfig
import AlertModal from "./AlertModal";

const AdminAcceptDasherModal = ({ isOpen, closeModal, googleLink, shopId }) => {
    const [deliveryFee, setDeliveryFee] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [onConfirmAction, setOnConfirmAction] = useState(null);

    const openModal = (title, message, confirmAction = null) => {
        setModalTitle(title);
        setModalMessage(message);
        setOnConfirmAction(() => confirmAction);
        setIsModalOpen(true);
    };

    const closeAlertModal = () => {
        setIsModalOpen(false);
        setOnConfirmAction(null);
    };

    if (!isOpen) return null;

    const handleDeliveryFeeChange = (e) => {
        const value = e.target.value;
        if (value === "" || parseFloat(value) >= 0) {
            setDeliveryFee(value);
        }
    };

    const confirmAccept = async () => {
        if (deliveryFee === "") {
            openModal('Action Needed', 'Please enter a delivery fee');
            return;
        }

        try {
            await axios.put(`/shops/update/${shopId}/deliveryFee`, null, { params: { deliveryFee: parseFloat(deliveryFee) } });
            await axios.put(`/shops/update/${shopId}/status`, null, { params: { status: 'active' } });
            await axios.put(`/users/update/${shopId}/accountType`, null, { params: { accountType: 'shop' } });

            openModal('Success', 'Shop accepted and account type updated successfully');
            setTimeout(() => {
                closeAlertModal();
                window.location.reload();
            }, 3000);
        } catch (error) {
            console.error('Error updating shop details:', error);
            openModal('Error', 'Error updating shop details');
        }
    };

    return (
        <>
            <AlertModal 
                isOpen={isModalOpen} 
                closeModal={closeAlertModal} 
                title={modalTitle} 
                message={modalMessage} 
                onConfirm={onConfirmAction} 
                showConfirmButton={!!onConfirmAction}
            />
            <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-70 z-40">
                <div className="bg-white p-6 rounded-lg shadow-lg w-96 relative">
                    <button className="absolute top-4 right-4 text-2xl text-gray-500 hover:text-gray-700" onClick={closeModal}>✖</button>
                    <h2 className="text-xl font-semibold mb-4">Accept Shop</h2>
                    <div className="mb-4">
                        <h4>
                            <a href={googleLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Google Maps Link</a>
                        </h4>
                    </div>
                    <div className="mb-4">
                        <label htmlFor="deliveryFee" className="block font-medium mb-1">Delivery Fee:</label>
                        <input
                            type="number"
                            id="deliveryFee"
                            className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500"
                            value={deliveryFee}
                            onChange={handleDeliveryFeeChange}
                        />
                    </div>
                    <div className="flex justify-end">
                        <button className="bg-red-500 text-white px-4 py-2 rounded-lg mr-2" onClick={closeModal}>Cancel</button>
                        <button className="bg-green-500 text-white px-4 py-2 rounded-lg" onClick={confirmAccept}>Confirm</button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AdminAcceptDasherModal;
