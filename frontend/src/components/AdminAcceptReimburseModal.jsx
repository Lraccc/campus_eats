import React, { useEffect, useState } from "react";
import axios from "../utils/axiosConfig"; // Import axiosConfig
import AlertModal from "./AlertModal";

const AdminAcceptReimburseModal = ({ isOpen, closeModal, reimburseId }) => {
    const [referenceNumber, setReferenceNumber] = useState("");
    const [reimburseData, setReimburseData] = useState(null);
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

    // Fetch reimburse data when the modal opens or reimburseId changes
    useEffect(() => {
        if (!isOpen) return; // Early return if the modal is not open

        const fetchReimburse = async () => {
            try {
                const response = await axios.get(`/reimburses/${reimburseId}`);
                setReimburseData(response.data); // Use response.data directly
            } catch (error) {
                console.error('Error fetching reimburse:', error);
            }
        };

        fetchReimburse();
    }, [isOpen, reimburseId]); // Dependencies: fetch reimburse data when modal opens or reimburseId changes

    const confirmAccept = async () => {
        if (referenceNumber === "") {
            openModal('Action Needed', 'Please enter the reference number');
            return;
        }

        try {
            // Update reference number
            await axios.put(`/reimburses/update/${reimburseId}/reference`, null, { params: { referenceNumber: referenceNumber } });

            // Update reimburse status
            await axios.put(`/reimburses/update/${reimburseId}/status`, null, { params: { status: 'paid' } });

            openModal('Success', 'Reimbursement successfully accepted');
            setTimeout(() => {
                closeAlertModal();
                window.location.reload();
            }, 3000);
        } catch (error) {
            console.error('Error updating reimburse details:', error);
            openModal('Error', 'Error updating reimburse details');
        }
    };

    if (!isOpen) return null; // Return null if the modal is not open

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
                    <button className="absolute top-4 right-4 text-2xl text-gray-500 hover:text-gray-700" onClick={closeModal}>X</button>
                    <h2 className="text-xl font-semibold mb-4">Confirm Transaction</h2>
                    <div className="mb-4">
                        <label htmlFor="referenceNumber" className="block font-medium mb-1">Reference Number:</label>
                        <input
                            type="text"
                            id="referenceNumber"
                            className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500"
                            value={referenceNumber}
                            onChange={(e) => setReferenceNumber(e.target.value)}
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

export default AdminAcceptReimburseModal;
