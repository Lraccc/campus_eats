import React, { useState } from "react";
import axios from "../../utils/axiosConfig";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload, faImage, faTimes } from "@fortawesome/free-solid-svg-icons";


const DasherNoShowModal = ({ isOpen, closeModal, orderData, shopData }) => {
    const [proofImage, setProofImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const fetchOffenses = async () => {
        // ✅ FIXED: Only fetch offense count, don't increment
        // Backend handles offense increment when processing no-show report
        if (orderData && orderData.uid) {
            try {
                const response = await axios.get(`/users/${orderData.uid}/offenses`);
                if (response.status === 200) {
                    console.log("Updated offense count:", response.data);
                }
            } catch (error) {
                console.error("Error fetching offenses:", error);
            }
        }
    };

    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setProofImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeImage = () => {
        setProofImage(null);
        setImagePreview(null);
    };
    if (!isOpen) return null;

    const confirm = async () => {
        if (!proofImage) {
            alert("Please upload an image as proof of no show");
            return;
        }

        try {
            setIsUploading(true);
            
            // Create form data to send the image
            const formData = new FormData();
            formData.append('orderId', orderData.id);
            formData.append('status', "no-show");
            formData.append('proofImage', proofImage);
            
            // Update order status with proof image
            const updateResponse = await axios.post('/orders/update-order-status-with-proof', 
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );

            if (updateResponse.status === 200) {
                await fetchOffenses();
                await axios.put(`/dashers/update/${orderData.dasherId}/status`, null, {
                    params: { status: 'active' }
                });
                window.location.reload();
            }
        } catch (error) {
            console.error('Error updating order status:', error);
            alert('Failed to update order status. Please try again.');
        } finally {
            setIsUploading(false);
        }   
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-70 z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-96 relative">
                <button className="absolute top-2 right-3 text-2xl text-gray-500 hover:text-gray-700" onClick={closeModal}>
                    ✖
                </button>
                <h2 className="text-2xl font-bold text-black mb-2 text-center">Marked Order as No Show</h2>
                <hr className="border-t border-gray-300 my-2" />
                <div className="mb-4 text-center">
                    <h4 className="text-lg font-medium">The customer failed to show up for the delivery.</h4>
                    <p className="text-sm text-gray-600 mt-2">Please upload an image as proof of the no-show (e.g., screenshot of location, attempts to contact customer).</p>
                </div>
                
                <div className="mb-4">
                    <div className="flex flex-col items-center">
                        {!imagePreview ? (
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-yellow-500 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <FontAwesomeIcon icon={faUpload} className="text-yellow-500 text-2xl mb-2" />
                                    <p className="text-sm text-gray-600">Upload Proof Image</p>
                                </div>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={handleImageSelect}
                                />
                            </label>
                        ) : (
                            <div className="relative w-full">
                                <div className="relative w-full h-48 overflow-hidden rounded-lg">
                                    <img 
                                        src={imagePreview} 
                                        alt="Proof of no-show" 
                                        className="w-full h-full object-cover"
                                    />
                                    <button 
                                        onClick={removeImage}
                                        className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
                                    >
                                        <FontAwesomeIcon icon={faTimes} className="text-red-500" />
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1 text-center">Image added</p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex justify-center space-x-4 mt-4">
                    <button 
                        className={`bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition duration-200 flex items-center ${isUploading ? 'opacity-75 cursor-not-allowed' : ''}`} 
                        onClick={confirm}
                        disabled={isUploading}
                    >
                        {isUploading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                            </>
                        ) : (
                            'Confirm'
                        )}
                    </button>
                    <button className="bg-gray-300 text-black px-4 py-2 rounded-lg hover:bg-gray-400 transition duration-200" onClick={closeModal} disabled={isUploading}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DasherNoShowModal;
