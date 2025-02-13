import React, { useState } from "react";
import axios from "../utils/axiosConfig"; // Import axiosConfig
import AlertModal from "./AlertModal";

const OrderEditPhoneNumModal = ({ isOpen, closeModal, mobileNum, orderId }) => {
    const [newMobileNum, setNewMobileNum] = useState("");
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

    const handleNewMobileNumChange = (e) => {
        const value = e.target.value;
        if (value === "" || parseFloat(value) >= 0) {
            setNewMobileNum(value);
        }
    };

    const confirmAccept = async () => {
        if (newMobileNum === "") {
            openModal('Action Needed', 'Please enter a new mobile number');
            return;
        }

        try {
            await axios.put(`/orders/update/${orderId}/mobileNum`, null, { params: { mobileNum: newMobileNum} });

            openModal('Success', 'Mobile number updated successfully');
            setTimeout(() => {
                closeAlertModal();
                window.location.reload();
            }, 3000);
        } catch (error) {
            console.error('Error updating mobile number:', error);
            openModal('Error', 'Error updating mobile number');
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
                    <h2 className="text-xl font-semibold mb-4">Edit Mobile Number</h2>
                    <div className="mb-4">
                        <h4>
                            Current Mobile Number: {mobileNum}
                        </h4>
                    </div>
                    <div className="mb-4">
                        <label htmlFor="newMobileNum" className="block font-medium mb-1">Enter new mobile number:</label>
                        <input
                            type="number"
                            id="newMobileNum"
                            className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500"
                            value={newMobileNum}
                            onChange={handleNewMobileNumChange}
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

export default OrderEditPhoneNumModal;
